import { Clinic } from "../../../models/client/Clinic.js";
import { Patient } from "../../../models/client/Patient.js";
import { PlatformInsurer } from "../../../models/admin/PlatformInsurer.js";
import { getDentalPayerDirectory } from "../../../services/stedi/payerDirectoryService.js";
import { fail, ok } from "../../../utils/client/apiResponse.js";

const normalize = (value) => String(value || "").trim().toLowerCase();

const providerForClinic = (clinic) => {
  const clinicName = String(clinic.claimProvider?.organizationName || "").trim();
  const clinicNpi = String(clinic.claimProvider?.npi || "").trim();
  const environmentName = String(process.env.STEDI_PROVIDER_ORGANIZATION_NAME || "").trim();
  const environmentNpi = String(process.env.STEDI_PROVIDER_NPI || "").trim();
  const organizationName = clinicName || environmentName || clinic.name;
  const npi = clinicNpi || environmentNpi;
  const missingFields = [];

  if (!organizationName) missingFields.push("organizationName");
  if (!/^\d{10}$/.test(npi)) missingFields.push("npi");

  return {
    organizationName,
    npiLast4: /^\d{10}$/.test(npi) ? npi.slice(-4) : "",
    source: clinicNpi ? "clinic" : environmentNpi ? "environment" : "missing",
    eligibilityReady: missingFields.length === 0,
    enrollmentReady: false,
    missingFields,
  };
};

const payerNameIndex = (payers) => {
  const index = new Map();
  for (const payer of payers) {
    const names = [payer.displayName, payer.conciseName, ...(payer.aliases || [])];
    for (const name of names) {
      const key = normalize(name);
      if (key && !index.has(key)) index.set(key, payer);
    }
  }
  return index;
};

const addPolicyUsage = (usage, policy, type) => {
  const stediId = String(policy?.payerStediId || "").trim().toUpperCase();
  const payerName = String(policy?.payer || "").trim();
  if (!stediId && (!payerName || normalize(payerName) === "unknown")) return;

  const key = stediId ? `id:${stediId}` : `name:${normalize(payerName)}`;
  const current = usage.get(key) || {
    stediId,
    payerName,
    patientIds: new Set(),
    primaryPolicies: 0,
    secondaryPolicies: 0,
  };

  if (policy.patientId) current.patientIds.add(String(policy.patientId));
  if (type === "secondary") current.secondaryPolicies += 1;
  else current.primaryPolicies += 1;
  usage.set(key, current);
};

const readinessFor = (provider, payer) => {
  if (!payer) return "payer_not_mapped";
  if (!provider.eligibilityReady) return "provider_setup_required";
  if (payer.eligibilityCheck === "ENROLLMENT_REQUIRED") return "production_enrollment_required";
  if (payer.eligibilityCheck !== "SUPPORTED") return "eligibility_not_supported";
  return "sandbox_ready";
};

const statusFor = (readiness, applicationActive) => {
  if (!applicationActive) {
    return { status: "inactive", reason: "Disabled for new policies by the MorlyIQ administrator." };
  }
  if (readiness === "sandbox_ready") return { status: "active", reason: "Ready for sandbox eligibility checks." };
  if (readiness === "provider_setup_required") {
    return { status: "pending", reason: "Complete this clinic's provider setup." };
  }
  if (readiness === "production_enrollment_required") {
    return { status: "pending", reason: "Production payer enrollment is required." };
  }
  if (readiness === "eligibility_not_supported") {
    return { status: "error", reason: "Eligibility checks are not supported by this payer." };
  }
  return { status: "error", reason: "Payer could not be matched to the active directory." };
};

// GET /api/client-panel/insurance-connections
// Read-only sandbox view. It never creates a Stedi provider or enrollment and
// derives the clinic's payer rows only from tenant/clinic-scoped patient policies.
export const listInsuranceConnections = async (req, res) => {
  try {
    const tenantId = req.user.tenantId._id;
    const [clinic, patients, directory, platformInsurers] = await Promise.all([
      Clinic.findOne({ tenantId, clinicId: req.clinicId }).lean(),
      Patient.find({ tenantId, clinicId: req.clinicId })
        .select("payer payerStediId cob.payer cob.payerStediId")
        .lean(),
      // Include every live directory payer so historical policies still resolve
      // even when an Admin disables that payer for new patient selection.
      getDentalPayerDirectory({ applicationOnly: false }),
      PlatformInsurer.find().select("payerStediId name primaryPayerId configuredStatus").lean(),
    ]);

    if (!clinic) return fail(res, 404, "Clinic not found", { code: "CLINIC_NOT_FOUND" });

    const provider = providerForClinic(clinic);
    const payers = directory.payers || [];
    const byStediId = new Map(payers.map((payer) => [payer.stediId, payer]));
    const byName = payerNameIndex(payers);
    const platformByPayer = new Map(platformInsurers.map((item) => [item.payerStediId, item]));
    const allowListEnabled = platformInsurers.length > 0;
    const usage = new Map();

    for (const patient of patients) {
      addPolicyUsage(usage, { ...patient, patientId: patient._id }, "primary");
      if (patient.cob) addPolicyUsage(usage, { ...patient.cob, patientId: patient._id }, "secondary");
    }

    // Legacy patients may contain only a payer name while newer records contain
    // the stable Stedi ID. Resolve first, then merge both shapes into one row.
    const resolvedUsage = new Map();
    for (const item of usage.values()) {
      const payer = (item.stediId && byStediId.get(item.stediId)) || byName.get(normalize(item.payerName)) || null;
      const key = payer?.stediId || `unmapped:${item.stediId || normalize(item.payerName)}`;
      const current = resolvedUsage.get(key) || {
        payer,
        directoryMatched: Boolean(payer),
        stediId: item.stediId,
        payerName: item.payerName,
        patientIds: new Set(),
        primaryPolicies: 0,
        secondaryPolicies: 0,
      };
      for (const patientId of item.patientIds) current.patientIds.add(patientId);
      current.primaryPolicies += item.primaryPolicies;
      current.secondaryPolicies += item.secondaryPolicies;
      resolvedUsage.set(key, current);
    }

    // Platform-configured insurers must be visible even before this clinic has
    // created a patient policy for them. Usage remains zero until that happens.
    for (const configured of platformInsurers) {
      if (resolvedUsage.has(configured.payerStediId)) continue;
      const directoryPayer = byStediId.get(configured.payerStediId) || null;
      resolvedUsage.set(configured.payerStediId, {
        payer: directoryPayer || {
          stediId: configured.payerStediId,
          displayName: configured.name,
          primaryPayerId: configured.primaryPayerId,
          eligibilityCheck: "UNKNOWN",
          dentalClaimSubmission: "UNKNOWN",
          claimStatus: "UNKNOWN",
          claimPayment: "UNKNOWN",
          coordinationOfBenefits: "UNKNOWN",
          lastSyncedAt: null,
        },
        directoryMatched: Boolean(directoryPayer),
        stediId: configured.payerStediId,
        payerName: configured.name,
        patientIds: new Set(),
        primaryPolicies: 0,
        secondaryPolicies: 0,
      });
    }

    const connections = [...resolvedUsage.values()]
      .map((item) => {
        const payer = item.payer;
        const platformInsurer = payer ? platformByPayer.get(payer.stediId) : null;
        const applicationActive = !allowListEnabled || platformInsurer?.configuredStatus === "active";
        const readiness = readinessFor(provider, payer);
        const connectionStatus = statusFor(readiness, applicationActive);
        return {
          id: payer?.stediId || `unmapped:${item.stediId || normalize(item.payerName)}`,
          directoryMatched: Boolean(item.directoryMatched),
          payer: payer
            ? {
                stediId: payer.stediId,
                displayName: payer.displayName,
                primaryPayerId: payer.primaryPayerId,
              }
            : {
                stediId: item.stediId,
                displayName: item.payerName || "Unmapped payer",
                primaryPayerId: "",
              },
          usage: {
            patients: item.patientIds.size,
            primaryPolicies: item.primaryPolicies,
            secondaryPolicies: item.secondaryPolicies,
          },
          integrationType: "Stedi / EDI Payer",
          lastChecked: payer?.lastSyncedAt || directory.cache?.refreshedAt || null,
          applicationActive,
          status: connectionStatus.status,
          statusReason: connectionStatus.reason,
          transactionSupport: {
            eligibility: payer?.eligibilityCheck || "UNKNOWN",
            dentalClaims: payer?.dentalClaimSubmission || "UNKNOWN",
            claimStatus: payer?.claimStatus || "UNKNOWN",
            era: payer?.claimPayment || "UNKNOWN",
            coordinationOfBenefits: payer?.coordinationOfBenefits || "UNKNOWN",
          },
          readiness,
        };
      })
      .sort((a, b) => a.payer.displayName.localeCompare(b.payer.displayName));

    return ok(res, "Sandbox insurance connections loaded", {
      mode: "sandbox",
      enrollmentAvailable: false,
      clinic: { id: clinic.clinicId, name: clinic.name },
      provider,
      directory: {
        source: directory.cache?.source || "cache",
        stale: Boolean(directory.cache?.stale),
        refreshedAt: directory.cache?.refreshedAt || null,
        matchedPayers: connections.filter((item) => item.directoryMatched).length,
      },
      connections,
    });
  } catch (error) {
    console.error(`[Stedi] insurance connections unavailable: ${error.code || error.message}`);
    return fail(res, 503, "Insurance connection status is temporarily unavailable", {
      code: error.code === "STEDI_NOT_CONFIGURED"
        ? "PAYER_DIRECTORY_NOT_CONFIGURED"
        : "INSURANCE_CONNECTIONS_UNAVAILABLE",
    });
  }
};
