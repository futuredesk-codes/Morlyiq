import crypto from "crypto";
import { Claim } from "../../../models/client/Claim.js";
import { Clinic } from "../../../models/client/Clinic.js";
import { Patient } from "../../../models/client/Patient.js";
import { CdtCode } from "../../../models/admin/CdtCode.js";
import { PlatformInsurer } from "../../../models/admin/PlatformInsurer.js";
import { StediPayer } from "../../../models/integrations/StediPayer.js";
import { logActivity } from "../../../services/client/activityService.js";
import { notifyClientSafely } from "../../../services/client/notificationService.js";
import {
  getClaimSubmissionDataSource,
  StediClaimError,
  submitDentalClaim,
} from "../../../services/stedi/dentalClaimService.js";
import { getClaimsMode, isTestClaimsMode } from "../../../config/stediRuntime.js";
import { created, fail, invalid, ok } from "../../../utils/client/apiResponse.js";

const scope = (req) => ({ tenantId: req.user.tenantId._id, clinicId: req.clinicId });
const claimScope = (req) => ({ ...scope(req), environment: getClaimsMode() });
const clean = (value) => String(value || "").trim();
const digits = (value) => clean(value).replace(/\D/g, "");
const configuredEligibilityMaxAgeDays = Number.parseInt(process.env.CLAIM_ELIGIBILITY_MAX_AGE_DAYS, 10);
const ELIGIBILITY_MAX_AGE_DAYS = Number.isFinite(configuredEligibilityMaxAgeDays) && configuredEligibilityMaxAgeDays > 0
  ? configuredEligibilityMaxAgeDays
  : 30;

const tenantHasEntitlement = (tenant, key) => {
  const value = tenant.entitlements instanceof Map
    ? tenant.entitlements.get(key)
    : tenant.entitlements?.[key];
  return value !== false;
};

const splitName = (fullName) => {
  const pieces = clean(fullName).split(/\s+/).filter(Boolean);
  if (pieces.length === 1) return { firstName: pieces[0], lastName: pieces[0] };
  return { firstName: pieces.shift() || "", lastName: pieces.join(" ") };
};

// Keep CLM01/Patient Control Number at 17 characters or fewer. Some payers
// truncate longer identifiers in 277CA/835 responses, which breaks matching.
const newClaimNumber = () =>
  `MIQ-${Date.now().toString(36).slice(-8)}-${crypto.randomBytes(2).toString("hex")}`.toUpperCase();

const providerFromClinic = (clinic) => {
  const configured = clinic.claimProvider || {};
  return {
    organizationName: clean(configured.organizationName || process.env.STEDI_CLAIM_PROVIDER_ORGANIZATION_NAME || clinic.name),
    providerType: clean(configured.providerType || (configured.taxIdType === "SSN" ? "individual" : "organization")).toLowerCase(),
    providerFirstName: clean(configured.providerFirstName),
    providerLastName: clean(configured.providerLastName),
    npi: digits(configured.npi || process.env.STEDI_CLAIM_PROVIDER_NPI),
    taxonomyCode: clean(configured.taxonomyCode || process.env.STEDI_CLAIM_PROVIDER_TAXONOMY_CODE || "122300000X").toUpperCase(),
    taxIdType: clean(configured.taxIdType || "EIN").toUpperCase(),
    employerId: digits(configured.employerId || process.env.STEDI_CLAIM_PROVIDER_EIN),
    phoneNumber: digits(configured.phoneNumber || process.env.STEDI_CLAIM_PROVIDER_PHONE),
    submitterId: clean(configured.submitterId || process.env.STEDI_CLAIM_PROVIDER_SUBMITTER_ID),
    address: {
      address1: clean(configured.address1 || process.env.STEDI_CLAIM_PROVIDER_ADDRESS1),
      address2: clean(configured.address2 || process.env.STEDI_CLAIM_PROVIDER_ADDRESS2),
      city: clean(configured.city || process.env.STEDI_CLAIM_PROVIDER_CITY),
      state: clean(configured.state || process.env.STEDI_CLAIM_PROVIDER_STATE).toUpperCase(),
      postalCode: clean(configured.postalCode || process.env.STEDI_CLAIM_PROVIDER_POSTAL_CODE),
      countryCode: clean(configured.countryCode || "US").toUpperCase(),
    },
  };
};

const normalizeSurfaces = (value) => {
  const values = Array.isArray(value) ? value : clean(value).split(",");
  return values.map((item) => clean(item).toUpperCase()).filter(Boolean);
};

const normalizeLines = async (rawLines, claimNumber) => {
  const lines = Array.isArray(rawLines) ? rawLines : [];
  const codes = [...new Set(lines.map((line) => clean(line.code).toUpperCase()).filter(Boolean))];
  const catalogue = await CdtCode.find({ code: { $in: codes } }).lean();
  const byCode = new Map(catalogue.map((item) => [item.code, item]));

  return lines.map((line, index) => {
    const code = clean(line.code).toUpperCase();
    const chargeCents = Number.isInteger(Number(line.chargeCents))
      ? Number(line.chargeCents)
      : Math.round(Number(line.charge || 0) * 100);
    return {
      code,
      description: clean(line.description || byCode.get(code)?.description),
      serviceDate: clean(line.serviceDate),
      chargeCents: Number.isFinite(chargeCents) ? Math.max(0, chargeCents) : 0,
      units: Math.max(1, Number.parseInt(line.units, 10) || 1),
      toothNumber: clean(line.toothNumber),
      toothSurfaces: normalizeSurfaces(line.toothSurfaces),
      providerControlNumber: clean(line.providerControlNumber || `${claimNumber}-${index + 1}`),
    };
  });
};

const assessEligibility = (patient) => {
  const result = patient?.result;
  const primary = result?.primary;
  const checkedAtValue = result?.checkedAt || primary?.checkedAt || null;
  const checkedAt = checkedAtValue ? new Date(checkedAtValue) : null;
  const checkedAtIsValid = checkedAt && !Number.isNaN(checkedAt.getTime());
  const ageMs = checkedAtIsValid ? Date.now() - checkedAt.getTime() : Number.POSITIVE_INFINITY;
  const staleAfterMs = ELIGIBILITY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

  if (!result || !primary) {
    return {
      status: "missing",
      code: "ELIGIBILITY_NOT_VERIFIED",
      message: "Eligibility has not been verified for this patient.",
      checkedAt: null,
      maxAgeDays: ELIGIBILITY_MAX_AGE_DAYS,
      submissionBlocked: true,
    };
  }
  if (primary.outcome !== "completed" || result.status === "failed") {
    return {
      status: "failed",
      code: "ELIGIBILITY_VERIFICATION_FAILED",
      message: "The latest primary eligibility verification was not successful.",
      checkedAt: checkedAtIsValid ? checkedAt : null,
      maxAgeDays: ELIGIBILITY_MAX_AGE_DAYS,
      submissionBlocked: true,
    };
  }
  if (result.status === "partial" || (result.secondary && result.secondary.outcome !== "completed")) {
    return {
      status: "partial",
      code: "ELIGIBILITY_PARTIALLY_VERIFIED",
      message: "Primary eligibility was verified, but a secondary policy could not be confirmed.",
      checkedAt: checkedAtIsValid ? checkedAt : null,
      maxAgeDays: ELIGIBILITY_MAX_AGE_DAYS,
      submissionBlocked: true,
    };
  }
  if (!checkedAtIsValid || ageMs > staleAfterMs) {
    return {
      status: "stale",
      code: "ELIGIBILITY_VERIFICATION_STALE",
      message: `The latest eligibility verification is older than ${ELIGIBILITY_MAX_AGE_DAYS} days.`,
      checkedAt: checkedAtIsValid ? checkedAt : null,
      maxAgeDays: ELIGIBILITY_MAX_AGE_DAYS,
      submissionBlocked: true,
    };
  }
  return {
    status: "confirmed",
    code: "ELIGIBILITY_CONFIRMED",
    message: "Current eligibility is confirmed for claim submission.",
    checkedAt,
    maxAgeDays: ELIGIBILITY_MAX_AGE_DAYS,
    submissionBlocked: false,
  };
};

const toClaim = (claim, patient = null) => ({
  id: claim.id,
  clinicId: claim.clinicId,
  patientId: String(claim.patientId),
  claimNumber: claim.claimNumber,
  environment: claim.environment,
  patient: claim.patient,
  payer: claim.payer,
  billingProvider: {
    organizationName: claim.billingProvider?.organizationName || "",
    npiLast4: claim.billingProvider?.npi ? claim.billingProvider.npi.slice(-4) : "",
    taxonomyCode: claim.billingProvider?.taxonomyCode || "",
  },
  diagnosisCode: claim.diagnosisCode || "",
  placeOfServiceCode: claim.placeOfServiceCode,
  serviceLines: claim.serviceLines,
  totalChargeCents: claim.totalChargeCents,
  testDataConfirmed: claim.testDataConfirmed,
  status: claim.status,
  validationErrors: claim.validationErrors || [],
  validationWarnings: claim.validationWarnings || [],
  validatedAt: claim.validatedAt,
  eligibility: assessEligibility(patient),
  submissionAttempts: claim.submissionAttempts,
  submittedAt: claim.submittedAt,
  stedi: claim.stedi,
  createdAt: claim.createdAt,
  updatedAt: claim.updatedAt,
});

const addProblem = (list, field, message, code = "") => list.push({ field, message, code });

const validateClaim = async (claim, patientRecord = null) => {
  const errors = [];
  const warnings = [];
  const patient = claim.patient || {};
  const patientAddress = patient.address || {};
  const provider = claim.billingProvider || {};
  const providerAddress = provider.address || {};

  if (claim.environment === "test" && !claim.testDataConfirmed) {
    addProblem(errors, "testDataConfirmed", "Confirm that this test claim contains synthetic data only", "TEST_DATA_CONFIRMATION_REQUIRED");
  }
  if (!clean(patient.firstName)) addProblem(errors, "patient.firstName", "Patient first name is required");
  if (!clean(patient.lastName)) addProblem(errors, "patient.lastName", "Patient last name is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(patient.dob))) addProblem(errors, "patient.dob", "Patient date of birth is invalid");
  if (!["M", "F", "U"].includes(patient.gender)) addProblem(errors, "patient.gender", "Select the patient's gender");
  if (!clean(patientAddress.address1)) addProblem(errors, "patient.address.address1", "Patient street address is required");
  if (!clean(patientAddress.city)) addProblem(errors, "patient.address.city", "Patient city is required");
  if (!/^[A-Z]{2}$/.test(clean(patientAddress.state).toUpperCase())) addProblem(errors, "patient.address.state", "Patient state must be a 2-letter code");
  if (!/^\d{5}(-\d{4})?$/.test(clean(patientAddress.postalCode))) addProblem(errors, "patient.address.postalCode", "Enter a valid patient ZIP code");

  if (!clean(claim.payer?.tradingPartnerServiceId)) addProblem(errors, "payer.tradingPartnerServiceId", "Payer routing ID is required");
  if (!clean(claim.payer?.memberId)) addProblem(errors, "payer.memberId", "Subscriber/member ID is required");

  if (!clean(provider.organizationName)) addProblem(errors, "billingProvider.organizationName", "Billing provider display name is required");
  if (!/^\d{10}$/.test(digits(provider.npi))) addProblem(errors, "billingProvider.npi", "Billing provider NPI must contain 10 digits");
  if (!clean(provider.taxonomyCode)) addProblem(errors, "billingProvider.taxonomyCode", "Billing provider taxonomy code is required");
  if (!["EIN", "SSN"].includes(provider.taxIdType)) addProblem(errors, "billingProvider.taxIdType", "Billing provider tax ID type must be EIN or SSN");
  if (!/^\d{9}$/.test(digits(provider.employerId))) addProblem(errors, "billingProvider.employerId", `Billing provider ${provider.taxIdType === "SSN" ? "SSN" : "EIN"} must contain 9 digits`);
  if (provider.taxIdType === "SSN" && !clean(provider.providerFirstName)) addProblem(errors, "billingProvider.providerFirstName", "Individual billing provider first name is required");
  if (provider.taxIdType === "SSN" && !clean(provider.providerLastName)) addProblem(errors, "billingProvider.providerLastName", "Individual billing provider last name is required");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits(provider.phoneNumber))) {
    addProblem(errors, "billingProvider.phoneNumber", "Enter a valid 10-digit US/Canada billing provider phone; area code and exchange cannot begin with 0 or 1");
  }
  if (!clean(providerAddress.address1)) addProblem(errors, "billingProvider.address.address1", "Billing provider street address is required");
  if (!clean(providerAddress.city)) addProblem(errors, "billingProvider.address.city", "Billing provider city is required");
  if (!/^[A-Z]{2}$/.test(clean(providerAddress.state).toUpperCase())) addProblem(errors, "billingProvider.address.state", "Billing provider state/province must be a 2-letter code");
  const providerCountry = clean(providerAddress.countryCode).toUpperCase();
  if (!["US", "CA"].includes(providerCountry)) addProblem(errors, "billingProvider.address.countryCode", "Billing provider country must be US or CA");
  const providerPostalValid = providerCountry === "CA"
    ? /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(clean(providerAddress.postalCode).toUpperCase())
    : /^\d{5}(-\d{4})?$/.test(clean(providerAddress.postalCode));
  if (!providerPostalValid) addProblem(errors, "billingProvider.address.postalCode", providerCountry === "CA" ? "Enter a valid Canadian billing provider postal code" : "Enter a valid US billing provider ZIP code");

  if (!claim.serviceLines?.length) addProblem(errors, "serviceLines", "Add at least one CDT service line");
  (claim.serviceLines || []).forEach((line, index) => {
    if (!/^D\d{4}$/.test(line.code)) addProblem(errors, `serviceLines.${index}.code`, "Use a valid CDT code such as D0120");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(line.serviceDate)) addProblem(errors, `serviceLines.${index}.serviceDate`, "Service date is required");
    if (!Number.isInteger(line.chargeCents) || line.chargeCents < 1) addProblem(errors, `serviceLines.${index}.charge`, "Service charge must be greater than $0");
    if (!Number.isInteger(line.units) || line.units < 1 || line.units > 99) addProblem(errors, `serviceLines.${index}.units`, "Units must be between 1 and 99");
  });

  const [payer, configuredCount, configuredPayer] = await Promise.all([
    StediPayer.findOne({ stediId: clean(claim.payer?.stediId).toUpperCase(), active: true }).lean(),
    PlatformInsurer.countDocuments(),
    PlatformInsurer.findOne({ payerStediId: clean(claim.payer?.stediId).toUpperCase() }).lean(),
  ]);
  if (!payer) addProblem(errors, "payer.stediId", "Payer is not available in the active Stedi directory", "PAYER_NOT_AVAILABLE");
  if (configuredCount > 0 && configuredPayer?.configuredStatus !== "active") {
    addProblem(warnings, "payer.stediId", "This payer is disabled for new policies by the MorlyIQ administrator", "PAYER_DISABLED_FOR_NEW_POLICIES");
  }
  const submissionSupport = payer?.transactionSupport?.dentalClaimSubmission || "NOT_SUPPORTED";
  if (payer && submissionSupport === "NOT_SUPPORTED" && claim.environment === "production") {
    addProblem(errors, "payer.stediId", "The payer directory does not list production dental claim submission support", "DENTAL_CLAIMS_NOT_SUPPORTED");
  } else if (payer && submissionSupport === "NOT_SUPPORTED") {
    addProblem(warnings, "payer.stediId", "The directory does not list production dental claim support; payer-specific test edits can still be checked", "DENTAL_CLAIMS_NOT_LISTED");
  } else if (payer && submissionSupport === "ENROLLMENT_REQUIRED") {
    addProblem(warnings, "payer.stediId", "This payer requires enrollment before production claim submission", "PAYER_ENROLLMENT_REQUIRED");
  }

  const eligibility = assessEligibility(patientRecord);
  if (eligibility.submissionBlocked) {
    addProblem(warnings, "eligibility", eligibility.message, eligibility.code);
  }
  const eligibilityBenefits = Array.isArray(patientRecord?.result?.primary?.benefits)
    ? patientRecord.result.primary.benefits
    : [];
  if (eligibilityBenefits.some((benefit) => benefit?.authorizationRequired === true)) {
    addProblem(
      warnings,
      "priorAuthorization",
      "The eligibility response indicates that prior authorization may be required. Confirm the requirement for the submitted CDT services.",
      "PRIOR_AUTHORIZATION_REVIEW_REQUIRED"
    );
  }
  const referralMentioned = eligibilityBenefits.some((benefit) => {
    const messages = Array.isArray(benefit?.messages) ? benefit.messages.join(" ") : "";
    return /\breferral\b/i.test(messages) && /\b(required|needed|obtain|must)\b/i.test(messages);
  });
  if (referralMentioned) {
    addProblem(
      warnings,
      "referral",
      "The eligibility response mentions a referral requirement. Confirm that a valid referral is on file.",
      "REFERRAL_REVIEW_REQUIRED"
    );
  }

  return { errors, warnings };
};

const findClaim = (req) => Claim.findOne({ _id: req.params.id, ...claimScope(req) }).catch(() => null);

const refreshClaimProvider = async (claim, req) => {
  const clinic = await Clinic.findOne(scope(req));
  if (clinic) claim.billingProvider = providerFromClinic(clinic);
};

export const listClaims = async (req, res) => {
  const claims = await Claim.find(claimScope(req)).sort({ createdAt: -1 });
  const patientIds = [...new Set(claims.map((claim) => String(claim.patientId)))];
  const patients = await Patient.find({ _id: { $in: patientIds }, ...scope(req) }).select("status result").lean();
  const patientsById = new Map(patients.map((patient) => [String(patient._id), patient]));
  ok(res, "Claims loaded", claims.map((claim) => toClaim(claim, patientsById.get(String(claim.patientId)))));
};

export const getClaimsConfiguration = async (req, res) => {
  const environment = getClaimsMode();
  ok(res, "Claims configuration loaded", {
    environment,
    requiresSyntheticDataConfirmation: environment === "test",
  });
};

export const getClaim = async (req, res) => {
  const claim = await findClaim(req);
  if (!claim) return fail(res, 404, "Claim not found at this clinic", { code: "CLAIM_NOT_FOUND" });
  const patient = await Patient.findOne({ _id: claim.patientId, ...scope(req) }).select("status result").lean();
  ok(res, "Claim loaded", toClaim(claim, patient));
};

export const createClaim = async (req, res) => {
  if (!tenantHasEntitlement(req.user.tenantId, "claims")) {
    return fail(res, 403, "Claims are not included in this practice plan", { code: "CLAIMS_NOT_INCLUDED" });
  }
  const patient = await Patient.findOne({ _id: req.body.patientId, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });
  const clinic = await Clinic.findOne(scope(req));
  if (!clinic) return fail(res, 404, "Clinic not found", { code: "CLINIC_NOT_FOUND" });

  const claimNumber = newClaimNumber();
  const serviceLines = await normalizeLines(req.body.serviceLines, claimNumber);
  const patientName = splitName(patient.name);
  const requestedGender = clean(req.body.patient?.gender || "U").toUpperCase();
  const claim = await Claim.create({
    ...scope(req),
    environment: getClaimsMode(),
    patientId: patient._id,
    claimNumber,
    patient: {
      fullName: patient.name,
      firstName: clean(req.body.patient?.firstName || patientName.firstName),
      lastName: clean(req.body.patient?.lastName || patientName.lastName),
      dob: patient.dob,
      gender: ["M", "F", "U"].includes(requestedGender) ? requestedGender : "U",
      address: {
        address1: clean(req.body.patient?.address?.address1),
        city: clean(req.body.patient?.address?.city),
        state: clean(req.body.patient?.address?.state).toUpperCase(),
        postalCode: clean(req.body.patient?.address?.postalCode),
        countryCode: "US",
      },
    },
    payer: {
      name: patient.payer,
      stediId: patient.payerStediId,
      tradingPartnerServiceId: patient.tradingPartnerServiceId,
      memberId: patient.subscriberId,
      groupNumber: patient.groupNumber,
    },
    billingProvider: providerFromClinic(clinic),
    diagnosisCode: clean(req.body.diagnosisCode).toUpperCase(),
    placeOfServiceCode: clean(req.body.placeOfServiceCode || "11"),
    claimFilingCode: clean(req.body.claimFilingCode || "CI").toUpperCase(),
    serviceLines,
    totalChargeCents: serviceLines.reduce((sum, line) => sum + line.chargeCents, 0),
    testDataConfirmed: isTestClaimsMode() && req.body.testDataConfirmed === true,
    idempotencyKey: crypto.randomUUID(),
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await logActivity(req.user, "Created claim draft", claim.claimNumber);
  created(res, "Claim draft created", toClaim(claim, patient));
};

export const updateClaim = async (req, res) => {
  const claim = await findClaim(req);
  if (!claim) return fail(res, 404, "Claim not found at this clinic", { code: "CLAIM_NOT_FOUND" });
  if (["submitting", "test_submitted", "stedi_accepted"].includes(claim.status)) {
    return fail(res, 409, "A submitted claim cannot be edited", { code: "CLAIM_LOCKED" });
  }

  if (req.body.patient) {
    claim.patient.firstName = clean(req.body.patient.firstName || claim.patient.firstName);
    claim.patient.lastName = clean(req.body.patient.lastName || claim.patient.lastName);
    const requestedGender = clean(req.body.patient.gender || claim.patient.gender).toUpperCase();
    claim.patient.gender = ["M", "F", "U"].includes(requestedGender) ? requestedGender : "U";
    claim.patient.address = {
      address1: clean(req.body.patient.address?.address1),
      city: clean(req.body.patient.address?.city),
      state: clean(req.body.patient.address?.state).toUpperCase(),
      postalCode: clean(req.body.patient.address?.postalCode),
      countryCode: "US",
    };
  }
  if (req.body.serviceLines) claim.serviceLines = await normalizeLines(req.body.serviceLines, claim.claimNumber);
  if (req.body.diagnosisCode !== undefined) claim.diagnosisCode = clean(req.body.diagnosisCode).toUpperCase();
  if (req.body.placeOfServiceCode !== undefined) claim.placeOfServiceCode = clean(req.body.placeOfServiceCode || "11");
  if (claim.environment === "test" && req.body.testDataConfirmed !== undefined) {
    claim.testDataConfirmed = req.body.testDataConfirmed === true;
  }
  await refreshClaimProvider(claim, req);
  claim.totalChargeCents = claim.serviceLines.reduce((sum, line) => sum + line.chargeCents, 0);
  claim.status = "draft";
  claim.validationErrors = [];
  claim.validationWarnings = [];
  claim.validatedAt = null;
  claim.idempotencyKey = crypto.randomUUID();
  claim.updatedBy = req.user._id;
  await claim.save();
  await logActivity(req.user, "Updated claim draft", claim.claimNumber);
  const patient = await Patient.findOne({ _id: claim.patientId, ...scope(req) }).select("status result").lean();
  ok(res, "Claim draft updated", toClaim(claim, patient));
};

export const validateClaimForSubmission = async (req, res) => {
  const claim = await findClaim(req);
  if (!claim) return fail(res, 404, "Claim not found at this clinic", { code: "CLAIM_NOT_FOUND" });
  if (["submitting", "test_submitted", "stedi_accepted"].includes(claim.status)) {
    return fail(res, 409, "This claim has already been submitted", { code: "CLAIM_LOCKED" });
  }
  await refreshClaimProvider(claim, req);
  const patient = await Patient.findOne({ _id: claim.patientId, ...scope(req) }).select("status result").lean();
  const result = await validateClaim(claim, patient);
  claim.validationErrors = result.errors;
  claim.validationWarnings = result.warnings;
  claim.validatedAt = new Date();
  claim.status = result.errors.length ? "validation_failed" : "ready";
  claim.updatedBy = req.user._id;
  await claim.save();
  if (result.errors.length) {
    return invalid(res, result.errors);
  }
  ok(res, "Claim is ready for submission", toClaim(claim, patient));
};

const responseProblems = (payload) => {
  const values = Array.isArray(payload?.errors)
    ? payload.errors
    : Array.isArray(payload?.claimReference?.errors)
      ? payload.claimReference.errors
      : [];
  return values.map((item) => ({
    field: "",
    code: clean(item.code || item.errorCode),
    message: clean(item.message || item.description || "Stedi returned a claim issue"),
  }));
};

export const submitClaimToStedi = async (req, res) => {
  const claim = await findClaim(req);
  if (!claim) return fail(res, 404, "Claim not found at this clinic", { code: "CLAIM_NOT_FOUND" });
  if (["submitting", "test_submitted", "stedi_accepted"].includes(claim.status)) {
    return fail(res, 409, "This claim has already been submitted", { code: "CLAIM_ALREADY_SUBMITTED" });
  }

  const patient = await Patient.findOne({ _id: claim.patientId, ...scope(req) }).select("status result").lean();
  const eligibility = assessEligibility(patient);
  if (eligibility.submissionBlocked) {
    return fail(res, 422, "Complete a successful, current eligibility verification before submitting this claim.", {
      code: "ELIGIBILITY_REQUIRED_FOR_CLAIM",
      errors: [{
        field: "eligibility",
        code: eligibility.code,
        message: eligibility.message,
      }],
    });
  }

  await refreshClaimProvider(claim, req);
  const result = await validateClaim(claim, patient);
  claim.validationErrors = result.errors;
  claim.validationWarnings = result.warnings;
  claim.validatedAt = new Date();
  if (result.errors.length) {
    claim.status = "validation_failed";
    await claim.save();
    return invalid(res, result.errors);
  }

  claim.status = "submitting";
  claim.submissionAttempts += 1;
  claim.updatedBy = req.user._id;
  await claim.save();

  try {
    const payload = await submitDentalClaim(claim);
    const stediErrors = responseProblems(payload);
    const accepted = String(payload?.status || "").toUpperCase() === "SUCCESS" && stediErrors.length === 0;
    claim.status = accepted ? "stedi_accepted" : "stedi_rejected";
    claim.submittedAt = new Date();
    claim.stedi = {
      correlationId: clean(payload?.claimReference?.correlationId || payload?.correlationId),
      controlNumber: clean(payload?.claimReference?.controlNumber || payload?.controlNumber),
      traceId: clean(payload?.meta?.traceId || payload?.traceId),
      status: clean(payload?.status),
      httpStatusCode: clean(payload?.httpStatusCode),
      payerId: clean(payload?.claimReference?.payerId || payload?.payer?.payerId || payload?.payerId || claim.payer.tradingPartnerServiceId),
      submissionDataSource: getClaimSubmissionDataSource(),
      errors: stediErrors,
      responseReceivedAt: new Date(),
    };
    await claim.save();
    await logActivity(req.user, accepted ? "Submitted claim to Stedi" : "Claim rejected by Stedi", claim.claimNumber);
    await notifyClientSafely({
      tenantId: req.user.tenantId._id,
      clinicId: req.clinicId,
      category: "claim",
      type: accepted ? "success" : "error",
      title: accepted ? "Claim accepted by Stedi" : "Claim needs attention",
      message: accepted
        ? `${claim.claimNumber} passed Stedi's initial 837D submission step.`
        : `${claim.claimNumber} was rejected during Stedi's initial submission step.`,
      audienceRoles: ["Owner", "Manager", "Billing", "Front Desk"],
      emailAudienceRoles: ["Owner", "Manager", "Billing"],
      actionUrl: "/claims",
      sourceType: "claim",
      sourceId: claim._id,
      dedupeKey: `claim:${claim._id}:${claim.status}`,
    });
    return ok(
      res,
      accepted
        ? "Claim accepted by Stedi. This is not payer adjudication or payment approval."
        : "Stedi returned claim validation issues",
      toClaim(claim, patient)
    );
  } catch (error) {
    const expected = error instanceof StediClaimError;
    const rejected = expected && error.code === "STEDI_CLAIM_REJECTED";
    claim.status = rejected ? "stedi_rejected" : "submission_error";
    claim.stedi.errors = (error.details?.length ? error.details : [{ message: error.message }]).map((item) => ({
      field: item.field || "",
      code: item.code || error.code || "",
      message: item.message || error.message,
    }));
    claim.stedi.responseReceivedAt = new Date();
    await claim.save();
    await logActivity(req.user, rejected ? "Claim rejected by Stedi" : "Claim submission failed", claim.claimNumber);
    return fail(res, expected ? error.status : 503, expected ? error.message : "Claim submission is temporarily unavailable", {
      code: expected ? error.code : "STEDI_CLAIM_UNAVAILABLE",
      errors: claim.stedi.errors,
    });
  }
};
