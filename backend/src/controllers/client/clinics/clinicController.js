import { logActivity } from "../../../services/client/activityService.js";
import { ok, created, fail, invalid } from "../../../utils/client/apiResponse.js";
import { Clinic } from "../../../models/client/Clinic.js";
import { accessibleClinics, roleForClinic } from "../../../middlewares/client/clinic/clinicAccess.js";
import {
  isStediAutoEnrollmentEnabled,
  refreshClinicStediEnrollment,
  StediEnrollmentError,
  syncClinicStediEnrollment,
} from "../../../services/stedi/enrollmentService.js";

const isOwner = (user) => (user.memberships || []).some((m) => m.active && m.clinicId === "*" && m.role === "Owner");
const clean = (value) => String(value || "").trim();
const digits = (value) => clean(value).replace(/\D/g, "");
const individualNameFromDisplay = (value) => {
  const parts = clean(value).split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.shift(), lastName: parts.join(" ") };
};
const validNpi = (value) => {
  const npi = digits(value);
  if (!/^\d{10}$/.test(npi)) return false;
  const payload = `80840${npi.slice(0, 9)}`;
  const sum = [...payload].reverse().reduce((total, character, index) => {
    const product = Number(character) * (index % 2 === 0 ? 2 : 1);
    return total + (product > 9 ? product - 9 : product);
  }, 0);
  return (10 - (sum % 10)) % 10 === Number(npi[9]);
};

const stediEnrollmentResponse = (clinic) => ({
  providerId: clinic.stediEnrollment?.providerId || "",
  enrollmentId: clinic.stediEnrollment?.enrollmentId || "",
  payerId: clinic.stediEnrollment?.payerId || "FRCPB",
  payerAlias: clinic.stediEnrollment?.payerAlias || "STEDITEST",
  transaction: clinic.stediEnrollment?.transaction || "claimPayment",
  syncStatus: clinic.stediEnrollment?.syncStatus || "not_synced",
  enrollmentStatus: clinic.stediEnrollment?.enrollmentStatus || "",
  providerSyncedAt: clinic.stediEnrollment?.providerSyncedAt || null,
  enrollmentCheckedAt: clinic.stediEnrollment?.enrollmentCheckedAt || null,
  lastAttemptAt: clinic.stediEnrollment?.lastAttemptAt || null,
  errorCode: clinic.stediEnrollment?.errorCode || "",
  errorMessage: clinic.stediEnrollment?.errorMessage || "",
  automationEnabled: isStediAutoEnrollmentEnabled(),
});

const claimProviderResponse = (clinic) => ({
  organizationName: clinic.claimProvider?.organizationName || clinic.name,
  providerType: clinic.claimProvider?.providerType || "organization",
  providerFirstName: clinic.claimProvider?.providerFirstName || "",
  providerLastName: clinic.claimProvider?.providerLastName || "",
  npi: clinic.claimProvider?.npi || "",
  taxonomyCode: clinic.claimProvider?.taxonomyCode || "122300000X",
  taxIdType: clinic.claimProvider?.taxIdType || "EIN",
  employerId: clinic.claimProvider?.employerId || "",
  contactType: clinic.claimProvider?.contactType || "organization",
  contactOrganizationName: clinic.claimProvider?.contactOrganizationName || clinic.claimProvider?.organizationName || clinic.name,
  phoneNumber: clinic.claimProvider?.phoneNumber || "",
  submitterId: clinic.claimProvider?.submitterId || "",
  address1: clinic.claimProvider?.address1 || "",
  address2: clinic.claimProvider?.address2 || "",
  city: clinic.claimProvider?.city || "",
  state: clinic.claimProvider?.state || "",
  postalCode: clinic.claimProvider?.postalCode || "",
  countryCode: clinic.claimProvider?.countryCode || "US",
  enrollmentContactEmail: clinic.claimProvider?.enrollmentContactEmail || "",
  stediEnrollment: stediEnrollmentResponse(clinic),
});

const clinicForProviderAccess = async (req, res) => {
  const role = roleForClinic(req.user, req.params.clinicId);
  if (!["Owner", "Manager"].includes(role)) {
    fail(res, 403, "Only an Owner or the clinic's Manager can manage claim provider setup");
    return null;
  }
  const clinic = await Clinic.findOne({ tenantId: req.user.tenantId._id, clinicId: req.params.clinicId });
  if (!clinic) {
    fail(res, 404, "Clinic not found");
    return null;
  }
  return clinic;
};

const sendStediError = (res, error) => {
  const status = error instanceof StediEnrollmentError ? error.status : 502;
  return fail(res, status, error.message || "Stedi enrollment sync failed", {
    code: error.code || "STEDI_ENROLLMENT_ERROR",
  });
};

// GET /api/client-panel/clinics — clinics the caller can access (with their role at each)
export const listClinics = async (req, res) => {
  ok(res, "Clinics loaded", await accessibleClinics(req.user));
};

// POST /api/client-panel/clinics — Owner only. Unlimited for now (plans are not built yet);
// set ENFORCE_CLINIC_QUOTA=true in .env to enforce the clinic limit (Client.clinics) set in the Admin console.
export const createClinic = async (req, res) => {
  if (!isOwner(req.user)) return fail(res, 403, "Only an Owner can add clinics");
  const tenant = req.user.tenantId;
  const name = String(req.body.name || "").trim();
  if (!name) return invalid(res, [{ field: "name", message: "Clinic name is required" }]);
  const existing = await Clinic.find({ tenantId: tenant._id });
  if (process.env.ENFORCE_CLINIC_QUOTA === "true" && existing.length >= tenant.clinics) {
    return fail(res, 403, `Your plan allows ${tenant.clinics} clinic${tenant.clinics === 1 ? "" : "s"}. Contact support to add more.`, { code: "PLAN_LIMIT_REACHED" });
  }
  const next = Math.max(0, ...existing.map((c) => Number(c.clinicId.replace(/\D/g, "")) || 0)) + 1;
  await Clinic.create({
    tenantId: tenant._id,
    clinicId: `cl${next}`,
    name,
    claimProvider: {
      organizationName: name,
      providerType: "organization",
      providerFirstName: "",
      providerLastName: "",
      taxonomyCode: "122300000X",
      taxIdType: "EIN",
      contactType: "organization",
      contactOrganizationName: name,
      countryCode: "US",
    },
  });
  logActivity(req.user, "Added clinic", name);
  created(res, "Clinic added", await accessibleClinics(req.user));
};

// PATCH /api/client-panel/clinics/:clinicId — Owner, or Manager of that clinic
export const updateClinic = async (req, res) => {
  const role = roleForClinic(req.user, req.params.clinicId);
  if (!["Owner", "Manager"].includes(role)) return fail(res, 403, "Only an Owner or the clinic's Manager can edit it");
  const clinic = await Clinic.findOne({ tenantId: req.user.tenantId._id, clinicId: req.params.clinicId });
  if (!clinic) return fail(res, 404, "Clinic not found");
  if (req.body.name !== undefined) {
    if (!String(req.body.name).trim()) return invalid(res, [{ field: "name", message: "Clinic name is required" }]);
    clinic.name = String(req.body.name).trim();
  }
  await clinic.save();
  logActivity(req.user, "Updated clinic details", clinic.name);
  ok(res, "Clinic updated", await accessibleClinics(req.user));
};

// GET /api/client-panel/clinics/:clinicId/claim-provider — restricted because
// the provider record includes the clinic's tax identifier.
export const getClaimProvider = async (req, res) => {
  const role = roleForClinic(req.user, req.params.clinicId);
  if (!["Owner", "Manager"].includes(role)) return fail(res, 403, "Only an Owner or the clinic's Manager can view claim provider setup");
  const clinic = await Clinic.findOne({ tenantId: req.user.tenantId._id, clinicId: req.params.clinicId });
  if (!clinic) return fail(res, 404, "Clinic not found");
  ok(res, "Claim provider loaded", claimProviderResponse(clinic));
};

// PATCH /api/client-panel/clinics/:clinicId/claim-provider
export const updateClaimProvider = async (req, res) => {
  const clinic = await clinicForProviderAccess(req, res);
  if (!clinic) return;

  const taxIdType = clean(req.body.taxIdType || "EIN").toUpperCase();
  const organizationName = clean(req.body.organizationName);
  const individualName = individualNameFromDisplay(organizationName);
  const provider = {
    organizationName,
    providerType: taxIdType === "SSN" ? "individual" : "organization",
    providerFirstName: taxIdType === "SSN" ? individualName.firstName : "",
    providerLastName: taxIdType === "SSN" ? individualName.lastName : "",
    npi: digits(req.body.npi),
    taxonomyCode: clean(req.body.taxonomyCode).toUpperCase(),
    taxIdType,
    employerId: digits(req.body.employerId),
    contactType: "organization",
    contactOrganizationName: clean(req.body.contactOrganizationName || req.body.organizationName),
    phoneNumber: digits(req.body.phoneNumber),
    submitterId: clean(req.body.submitterId),
    address1: clean(req.body.address1),
    address2: clean(req.body.address2),
    city: clean(req.body.city),
    state: clean(req.body.state).toUpperCase(),
    postalCode: clean(req.body.postalCode),
    countryCode: clean(req.body.countryCode || "US").toUpperCase(),
    enrollmentContactEmail: clean(req.body.enrollmentContactEmail || req.user.email).toLowerCase(),
  };
  const errors = [];
  if (provider.countryCode === "CA") provider.postalCode = provider.postalCode.toUpperCase();
  if (!provider.organizationName) errors.push({ field: "organizationName", message: "Provider display name is required" });
  if (!validNpi(provider.npi)) errors.push({ field: "npi", message: "Enter a valid 10-digit NPI" });
  if (!/^[A-Z0-9]{10}$/.test(provider.taxonomyCode)) errors.push({ field: "taxonomyCode", message: "Enter a valid 10-character taxonomy code" });
  if (!["EIN", "SSN"].includes(provider.taxIdType)) errors.push({ field: "taxIdType", message: "Tax ID type must be EIN or SSN" });
  if (!/^\d{9}$/.test(provider.employerId)) errors.push({ field: "employerId", message: `${provider.taxIdType === "SSN" ? "SSN" : "EIN"} must contain exactly 9 digits` });
  if (provider.taxIdType === "SSN" && !provider.providerLastName) errors.push({ field: "organizationName", message: "Enter the individual provider's full name when using SSN" });
  if (!provider.contactOrganizationName) errors.push({ field: "contactOrganizationName", message: "Contact organization name is required" });
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(provider.phoneNumber)) {
    errors.push({ field: "phoneNumber", message: "Enter a valid 10-digit US/Canada phone number; area code and exchange cannot begin with 0 or 1" });
  }
  if (!provider.address1) errors.push({ field: "address1", message: "Physical street address is required" });
  if (!provider.city) errors.push({ field: "city", message: "City is required" });
  if (!/^[A-Z]{2}$/.test(provider.state)) errors.push({ field: "state", message: "State/province must be a 2-letter code" });
  if (!["US", "CA"].includes(provider.countryCode)) errors.push({ field: "countryCode", message: "Country must be United States or Canada" });
  const validPostalCode = provider.countryCode === "CA"
    ? /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(provider.postalCode.toUpperCase())
    : /^\d{5}(-\d{4})?$/.test(provider.postalCode);
  if (!validPostalCode) errors.push({ field: "postalCode", message: provider.countryCode === "CA" ? "Enter a valid Canadian postal code" : "Enter a valid US ZIP code" });
  if (!/^\S+@\S+\.\S+$/.test(provider.enrollmentContactEmail)) {
    errors.push({ field: "enrollmentContactEmail", message: "Enter a valid enrollment contact email" });
  }
  if (errors.length) return invalid(res, errors);

  clinic.claimProvider = provider;
  await clinic.save();
  await logActivity(req.user, "Updated dental claim provider", clinic.name);
  let syncError = null;
  if (isStediAutoEnrollmentEnabled()) {
    try {
      await syncClinicStediEnrollment(clinic);
      await logActivity(req.user, "Synced Stedi test ERA enrollment", clinic.name);
    } catch (error) {
      syncError = error;
      await logActivity(req.user, "Stedi test ERA enrollment sync needs attention", clinic.name);
    }
  }

  const message = syncError
    ? `Provider saved. Stedi sync needs attention: ${syncError.message}`
    : isStediAutoEnrollmentEnabled()
      ? "Provider saved and Stedi test enrollment synchronized"
      : "Provider saved; automatic Stedi enrollment is disabled";
  ok(res, message, claimProviderResponse(clinic));
};

// POST /api/client-panel/clinics/:clinicId/claim-provider/stedi-sync
// Duplicate-safe: reuses exact NPI/EIN provider and claimPayment enrollment records.
export const syncClaimProviderWithStedi = async (req, res) => {
  const clinic = await clinicForProviderAccess(req, res);
  if (!clinic) return;
  try {
    await syncClinicStediEnrollment(clinic);
    await logActivity(req.user, "Synced Stedi test ERA enrollment", clinic.name);
    ok(res, "Stedi provider and test ERA enrollment synchronized", claimProviderResponse(clinic));
  } catch (error) {
    await logActivity(req.user, "Stedi test ERA enrollment sync failed", clinic.name);
    sendStediError(res, error);
  }
};

// POST /api/client-panel/clinics/:clinicId/claim-provider/stedi-refresh
export const refreshClaimProviderStediStatus = async (req, res) => {
  const clinic = await clinicForProviderAccess(req, res);
  if (!clinic) return;
  try {
    await refreshClinicStediEnrollment(clinic);
    await logActivity(req.user, "Refreshed Stedi test ERA enrollment status", clinic.name);
    ok(res, "Stedi enrollment status refreshed", claimProviderResponse(clinic));
  } catch (error) {
    sendStediError(res, error);
  }
};
