import { logActivity } from "../../../services/client/activityService.js";
import { ok, created, fail, invalid } from "../../../utils/client/apiResponse.js";
import { Patient } from "../../../models/client/Patient.js";
import { Clinic } from "../../../models/client/Clinic.js";
import { EligibilityCheck } from "../../../models/client/EligibilityCheck.js";
import { Client } from "../../../models/Client.js";
import {
  failedPolicyResult,
  runPolicyEligibility,
} from "../../../services/stedi/eligibilityService.js";
import { notifyClientSafely } from "../../../services/client/notificationService.js";
import { getSelectableDentalPayersByIds } from "../../../services/stedi/payerDirectoryService.js";


const toPatient = (p) => ({
  id: p.id,
  clinicId: p.clinicId,
  name: p.name,
  dob: p.dob,
  payer: p.payer,
  payerStediId: p.payerStediId || "",
  tradingPartnerServiceId: p.tradingPartnerServiceId || "",
  subscriberId: p.subscriberId || "",
  groupNumber: p.groupNumber || "",
  appointment: p.appointment, // ISO date-time, or null
  codes: p.codes,
  status: p.status,
  result: p.result,
  aiSummary: p.aiSummary,
  patientSummary: p.patientSummary,
  aiReviewed: p.aiReviewed,
  claimStatus: p.claimStatus || "not_submitted",
  claimSubmittedAt: p.claimSubmittedAt || null,
  cob: p.cob,
});

// Every query is limited to the caller's practice AND the active clinic (X-Clinic-Id, checked by scopeClinic)
const scope = (req) => ({ tenantId: req.user.tenantId._id, clinicId: req.clinicId });

const parseDate = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const validDateOfBirth = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const exactDate = parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
  return exactDate && parsed.getTime() <= Date.now();
};

// GET /api/client-panel/patients — patients of the ACTIVE clinic, soonest appointment first
export const listPatients = async (req, res) => {
  const patients = await Patient.find(scope(req)).sort({ appointment: 1, createdAt: 1 });
  ok(res, "Patients loaded", patients.map(toPatient));
};

// POST /api/client-panel/patients — adds a patient to the ACTIVE clinic
export const createPatient = async (req, res) => {
  const name = String(req.body.name || "").trim();
  const dob = String(req.body.dob || "").trim();
  const payerStediId = String(req.body.payerStediId || "").trim().toUpperCase();
  const subscriberId = String(req.body.subscriberId || "").trim();
  const groupNumber = String(req.body.groupNumber || "").trim();
  const appointmentInput = String(req.body.appointment || "").trim();
  const appointment = appointmentInput ? parseDate(appointmentInput) : null;
  const errors = [];
  if (!name) errors.push({ field: "name", message: "Patient name is required" });
  if (!dob) errors.push({ field: "dob", message: "Date of birth is required" });
  else if (!validDateOfBirth(dob)) errors.push({ field: "dob", message: "Enter a valid date of birth that is not in the future" });
  if (!payerStediId) errors.push({ field: "payerStediId", message: "Insurance payer is required" });
  if (!subscriberId) errors.push({ field: "subscriberId", message: "Subscriber ID / Member ID is required" });
  if (appointmentInput && !appointment) errors.push({ field: "appointment", message: "Enter a valid appointment date and time" });
  let payerRecord = null;
  if (payerStediId) {
    [payerRecord] = await getSelectableDentalPayersByIds([payerStediId]);
    if (!payerRecord) errors.push({ field: "payerStediId", message: "Select an insurer enabled for this application" });
  }
  if (errors.length) return invalid(res, errors);

  const patient = await Patient.create({
    ...scope(req),
    name,
    dob,
    payer: payerRecord.displayName,
    payerStediId: payerRecord.stediId,
    tradingPartnerServiceId: payerRecord.primaryPayerId || payerRecord.stediId,
    subscriberId,
    groupNumber,
    appointment,
    createdBy: req.user.id,
  });
  logActivity(req.user, "Added patient", name);
  if (patient.appointment) {
    await notifyClientSafely({
      tenantId: req.user.tenantId._id,
      clinicId: req.clinicId,
      category: "appointment",
      type: "info",
      title: "New patient appointment",
      message: `An appointment was scheduled for ${patient.name}.`,
      audienceRoles: ["Owner", "Manager", "Front Desk", "Dentist"],
      actionUrl: "/patients",
      sourceType: "patient",
      sourceId: patient._id,
    });
  }
  created(res, "Patient added", toPatient(patient));
};

const MAX_IMPORT_ROWS = 500;
const importDuplicateKey = ({ payerStediId, subscriberId, dob }) =>
  `${String(payerStediId || "").trim().toUpperCase()}|${String(subscriberId || "").trim().toLowerCase()}|${String(dob || "").trim()}`;

// POST /api/client-panel/patients/import — imports pre-mapped CSV/XLSX rows.
// The browser parses the file for a responsive mapping preview, but this endpoint
// independently validates every row and resolves every payer from the active
// Stedi directory before anything is written.
export const importPatients = async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows?.length) {
    return invalid(res, [{ field: "rows", message: "Add at least one patient row to import" }]);
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    return fail(res, 422, `Import up to ${MAX_IMPORT_ROWS} patients at a time`, {
      code: "PATIENT_IMPORT_LIMIT_EXCEEDED",
      errors: [{ field: "rows", message: `Maximum ${MAX_IMPORT_ROWS} rows per import` }],
    });
  }

  const payerIds = [...new Set(rows.map((row) => String(row?.payerStediId || "").trim().toUpperCase()).filter(Boolean))];
  const payerRecords = await getSelectableDentalPayersByIds(payerIds);
  const payerById = new Map(payerRecords.map((payer) => [payer.stediId, payer]));
  const existing = await Patient.find(scope(req)).select("payerStediId subscriberId dob").lean();
  const duplicateKeys = new Set(existing.map(importDuplicateKey));
  const accepted = [];
  const rejected = [];

  rows.forEach((raw, index) => {
    const sourceRow = Number.isInteger(Number(raw?.sourceRow)) ? Number(raw.sourceRow) : index + 2;
    const name = String(raw?.name || "").trim();
    const dob = String(raw?.dob || "").trim();
    const payerStediId = String(raw?.payerStediId || "").trim().toUpperCase();
    const subscriberId = String(raw?.subscriberId || "").trim();
    const groupNumber = String(raw?.groupNumber || "").trim();
    const appointmentInput = String(raw?.appointment || "").trim();
    const appointment = appointmentInput ? parseDate(appointmentInput) : null;
    const payer = payerById.get(payerStediId);
    const errors = [];

    if (!name) errors.push("Patient name is required");
    else if (name.length > 160) errors.push("Patient name must be 160 characters or less");
    if (!validDateOfBirth(dob)) errors.push("Enter a valid date of birth that is not in the future");
    if (!payer) errors.push("Select a valid active payer from the Stedi directory");
    if (!subscriberId) errors.push("Subscriber ID / Member ID is required");
    else if (subscriberId.length > 120) errors.push("Subscriber ID must be 120 characters or less");
    if (groupNumber.length > 120) errors.push("Group number must be 120 characters or less");
    if (appointmentInput && !appointment) errors.push("Enter a valid appointment date and time");

    const duplicateKey = importDuplicateKey({ payerStediId, subscriberId, dob });
    if (!errors.length && duplicateKeys.has(duplicateKey)) errors.push("Patient policy already exists in this clinic or import file");

    if (errors.length) {
      rejected.push({ sourceRow, name, errors });
      return;
    }

    duplicateKeys.add(duplicateKey);
    accepted.push({
      ...scope(req),
      name,
      dob,
      payer: payer.displayName,
      payerStediId: payer.stediId,
      tradingPartnerServiceId: payer.primaryPayerId || payer.stediId,
      subscriberId,
      groupNumber,
      appointment,
      createdBy: req.user.id,
    });
  });

  const inserted = accepted.length ? await Patient.insertMany(accepted, { ordered: true }) : [];
  if (inserted.length) logActivity(req.user, `Imported ${inserted.length} patients`, req.clinicId);

  return created(res, `Imported ${inserted.length} patient${inserted.length === 1 ? "" : "s"}`, {
    patients: inserted.map(toPatient),
    summary: {
      received: rows.length,
      imported: inserted.length,
      rejected: rejected.length,
    },
    rejected,
  });
};

// Verification outcomes and secondary policies have dedicated validated routes;
// the generic patient patch endpoint cannot spoof them.
const UPDATABLE = ["aiSummary", "patientSummary", "aiReviewed", "appointment", "dob"];

// PATCH /api/client-panel/patients/:id
export const updatePatient = async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });

  const changes = Object.fromEntries(UPDATABLE.filter((k) => req.body[k] !== undefined).map((k) => [k, req.body[k]]));
  if (changes.appointment !== undefined) {
    if (changes.appointment === null || changes.appointment === "") {
      changes.appointment = null;
    } else {
      changes.appointment = parseDate(changes.appointment);
      if (!changes.appointment) return invalid(res, [{ field: "appointment", message: "Enter a valid appointment date and time" }]);
    }
  }
  patient.set(changes);
  await patient.save();
  ok(res, "Patient updated", toPatient(patient));
};

// POST /api/client-panel/patients/:id/claim-submission
// This records MorlyIQ's internal workflow state. It does not send an 837D
// transaction to a payer or clearinghouse.
export const submitClaim = async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });
  if (patient.result?.primary?.outcome !== "completed") {
    return fail(res, 422, "Complete a successful eligibility check before submitting the claim", {
      code: "ELIGIBILITY_REQUIRED_FOR_CLAIM",
    });
  }
  if (!patient.codes?.length) {
    return fail(res, 422, "Add at least one CDT code before submitting the claim", {
      code: "CDT_CODE_REQUIRED_FOR_CLAIM",
    });
  }
  const newlySubmitted = patient.claimStatus !== "submitted";
  if (newlySubmitted) {
    patient.claimStatus = "submitted";
    patient.claimSubmittedAt = new Date();
    await patient.save();
    logActivity(req.user, "Marked claim submitted", patient.name);
    await notifyClientSafely({
      tenantId: req.user.tenantId._id,
      clinicId: req.clinicId,
      category: "claim",
      type: "info",
      title: "Claim submitted",
      message: `A claim was submitted for ${patient.name}.`,
      audienceRoles: ["Owner", "Manager", "Billing", "Front Desk"],
      emailAudienceRoles: ["Owner", "Manager", "Billing"],
      actionUrl: "/claims",
      sourceType: "patient_claim",
      sourceId: patient._id,
      dedupeKey: `claim-submitted:${patient._id}`,
    });
  }
  ok(res, "Claim marked as submitted in MorlyIQ", toPatient(patient));
};

const payerFromDirectory = async (payerStediId) => {
  const normalized = String(payerStediId || "").trim().toUpperCase();
  if (!normalized) return null;
  const [payer] = await getSelectableDentalPayersByIds([normalized]);
  return payer || null;
};

// PUT /api/client-panel/patients/:id/secondary-insurance
export const saveSecondaryInsurance = async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });

  const payerStediId = String(req.body.payerStediId || "").trim().toUpperCase();
  const subscriberId = String(req.body.subscriberId || "").trim();
  const groupNumber = String(req.body.groupNumber || "").trim();
  const relationship = String(req.body.relationship || "Spouse").trim();
  const errors = [];
  if (!payerStediId) errors.push({ field: "payerStediId", message: "Secondary insurance payer is required" });
  if (!subscriberId) errors.push({ field: "subscriberId", message: "Secondary subscriber ID is required" });
  if (!["Self", "Spouse", "Parent", "Child", "Other"].includes(relationship)) {
    errors.push({ field: "relationship", message: "Select a valid relationship to subscriber" });
  }
  const payer = payerStediId ? await payerFromDirectory(payerStediId) : null;
  if (payerStediId && !payer) errors.push({ field: "payerStediId", message: "Select a valid active payer from the directory" });
  if (payer && payer.stediId === patient.payerStediId) {
    errors.push({ field: "payerStediId", message: "Secondary payer must be different from the primary payer" });
  }
  if (errors.length) return invalid(res, errors);

  patient.cob = {
    payer: payer.displayName,
    payerStediId: payer.stediId,
    tradingPartnerServiceId: payer.primaryPayerId || payer.stediId,
    subscriberId,
    groupNumber,
    relationship,
  };
  patient.status = "not_verified";
  patient.result = null;
  await patient.save();
  logActivity(req.user, "Updated secondary insurance", patient.name);
  ok(res, "Secondary insurance saved", toPatient(patient));
};

// DELETE /api/client-panel/patients/:id/secondary-insurance
export const removeSecondaryInsurance = async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });
  patient.cob = null;
  patient.status = "not_verified";
  patient.result = null;
  await patient.save();
  logActivity(req.user, "Removed secondary insurance", patient.name);
  ok(res, "Secondary insurance removed", toPatient(patient));
};

const providerForClinic = (clinic) => ({
  organizationName: clinic.claimProvider?.organizationName
    || process.env.STEDI_PROVIDER_ORGANIZATION_NAME
    || clinic.name,
  npi: clinic.claimProvider?.npi || process.env.STEDI_PROVIDER_NPI || "",
});

const hasEligibilityEntitlement = (tenant) => {
  const value = tenant.entitlements instanceof Map
    ? tenant.entitlements.get("eligibility")
    : tenant.entitlements?.eligibility;
  return value !== false;
};

// POST /api/client-panel/patients/:id/eligibility
// One Stedi 270/271 transaction is sent per policy. Secondary coverage is not
// embedded in the primary request and is not the separate Stedi COB product.
export const verifyEligibility = async (req, res) => {
  const patient = await Patient.findOne({ _id: req.params.id, ...scope(req) }).catch(() => null);
  if (!patient) return fail(res, 404, "Patient not found at this clinic", { code: "PATIENT_NOT_FOUND" });
  if (!hasEligibilityEntitlement(req.user.tenantId)) {
    return fail(res, 403, "Eligibility checks are not enabled for this plan", { code: "FEATURE_NOT_ENABLED" });
  }

  const clinic = await Clinic.findOne(scope(req)).lean();
  if (!clinic) return fail(res, 404, "Clinic not found", { code: "CLINIC_NOT_FOUND" });
  const provider = providerForClinic(clinic);
  if (!/^\d{10}$/.test(provider.npi)) {
    return fail(res, 422, "Configure a valid 10-digit billing provider NPI for this clinic before checking eligibility", {
      code: "ELIGIBILITY_PROVIDER_REQUIRED",
      errors: [{ field: "claimProvider.npi", message: "A valid 10-digit NPI is required" }],
    });
  }
  if ((!patient.tradingPartnerServiceId && !patient.payerStediId) || !patient.subscriberId || !patient.dob) {
    return fail(res, 422, "Primary insurance details are incomplete", { code: "PRIMARY_INSURANCE_INCOMPLETE" });
  }

  const includeSecondary = req.body?.includeSecondary !== false;
  const policies = [{
    type: "primary",
    value: {
      payer: patient.payer,
      payerStediId: patient.payerStediId,
      tradingPartnerServiceId: patient.tradingPartnerServiceId || patient.payerStediId,
      subscriberId: patient.subscriberId,
      groupNumber: patient.groupNumber,
      relationship: "Self",
    },
  }];
  if (includeSecondary && patient.cob?.subscriberId && patient.cob?.tradingPartnerServiceId) {
    policies.push({ type: "secondary", value: patient.cob.toObject?.() || patient.cob });
  }

  patient.status = "in_progress";
  await patient.save();

  const settled = await Promise.allSettled(
    policies.map(({ type, value }) => runPolicyEligibility({
      patient,
      policy: value,
      provider,
      policyType: type,
    }))
  );
  const policyResults = settled.map((entry, index) => entry.status === "fulfilled"
    ? entry.value
    : failedPolicyResult({
      policy: policies[index].value,
      policyType: policies[index].type,
      error: entry.reason,
    }));
  const primary = policyResults[0];
  const secondary = policyResults[1] || null;
  const overallStatus = primary.outcome !== "completed"
    ? "failed"
    : secondary && secondary.outcome !== "completed"
      ? "partial"
      : "completed";
  const verification = {
    status: overallStatus,
    primary,
    secondary,
    checkedAt: new Date().toISOString(),
    transactionCount: policies.length,
  };

  patient.status = overallStatus;
  patient.result = verification;
  patient.aiSummary = null;
  patient.patientSummary = null;
  patient.aiReviewed = false;
  await patient.save();
  await Promise.all([
    EligibilityCheck.create({
      ...scope(req),
      patientId: patient._id,
      requestedBy: req.user._id,
      status: overallStatus,
      primary,
      secondary,
      checkedAt: new Date(verification.checkedAt),
    }),
    Client.findByIdAndUpdate(req.user.tenantId._id, { $inc: { verifications: policies.length } }),
  ]);
  logActivity(req.user, "Ran eligibility verification", patient.name);
  await notifyClientSafely({
    tenantId: req.user.tenantId._id,
    clinicId: req.clinicId,
    category: "verification",
    type: overallStatus === "completed" ? "success" : overallStatus === "partial" ? "warn" : "danger",
    title: overallStatus === "completed" ? "Eligibility verified" : "Eligibility needs attention",
    message: overallStatus === "completed"
      ? `Eligibility verification completed for ${patient.name}.`
      : `Eligibility verification for ${patient.name} finished with status: ${overallStatus}.`,
    audienceRoles: ["Owner", "Manager", "Front Desk"],
    emailAudienceRoles: ["Owner", "Manager", "Front Desk", "Dentist", "Billing"],
    actionUrl: `/patients/${patient._id}/eligibility`,
    sourceType: "eligibility_check",
    sourceId: patient._id,
  });
  ok(res, overallStatus === "completed" ? "Eligibility check completed" : "Eligibility check completed with issues", {
    patient: toPatient(patient),
    verification,
  });
};
