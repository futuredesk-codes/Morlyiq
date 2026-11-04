import { STEDI_TEST_CLAIM_FIXTURE } from "../../config/stediTestClaimFixture.js";
import {
  assertStediRuntimeSafety,
  envEnabled,
  getClaimsMode,
  getStediApiKey,
  isTestClaimsMode,
} from "../../config/stediRuntime.js";

const DEFAULT_DENTAL_CLAIMS_URL = "https://healthcare.us.stedi.com/2024-04-01/dental-claims/submission";
const DEFAULT_TIMEOUT_MS = 30_000;

export class StediClaimError extends Error {
  constructor(message, { code = "STEDI_CLAIM_ERROR", status = 502, details = [] } = {}) {
    super(message);
    this.name = "StediClaimError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const clean = (value) => String(value || "").trim();
const compactDate = (value) => clean(value).replaceAll("-", "");
const dollars = (cents) => (Number(cents || 0) / 100).toFixed(2);
export const usesTestClaimFixture = () =>
  isTestClaimsMode() && envEnabled(process.env.STEDI_TEST_CLAIM_MOCK_ENABLED);

export const getClaimSubmissionDataSource = () => usesTestClaimFixture() ? "code_fixture" : "application";

const mockServiceDate = () => new Date().toISOString().slice(0, 10).replaceAll("-", "");

export const buildTestFixtureDentalClaimPayload = (claim) => {
  const { payer, provider, subscriber, service } = STEDI_TEST_CLAIM_FIXTURE;
  const serviceDate = mockServiceDate();

  return {
    billing: {
      address: { ...provider.address },
      contactInformation: { name: provider.organizationName, phoneNumber: provider.phoneNumber },
      ...(provider.taxIdType === "SSN" ? { ssn: provider.employerId } : { employerId: provider.employerId }),
      npi: provider.npi,
      ...(provider.taxIdType === "SSN"
        ? { firstName: provider.providerFirstName, lastName: provider.providerLastName }
        : { organizationName: provider.organizationName }),
      providerType: "BillingProvider",
      taxonomyCode: provider.taxonomyCode,
    },
    claimInformation: {
      benefitsAssignmentCertificationIndicator: "Y",
      claimChargeAmount: dollars(service.chargeCents),
      claimDateInformation: { serviceDate },
      claimFilingCode: service.claimFilingCode,
      claimFrequencyCode: "1",
      patientControlNumber: claim.claimNumber,
      placeOfServiceCode: service.placeOfServiceCode,
      planParticipationCode: "A",
      releaseInformationCode: "Y",
      serviceLines: [{
        dentalService: {
          lineItemChargeAmount: dollars(service.chargeCents),
          placeOfServiceCode: service.placeOfServiceCode,
          procedureCode: service.cdtCode,
          procedureCount: service.units,
        },
        providerControlNumber: `${claim.claimNumber}-1`,
        serviceDate,
      }],
      signatureIndicator: "Y",
    },
    receiver: { organizationName: payer.name },
    submitter: {
      contactInformation: { name: provider.organizationName, phoneNumber: provider.phoneNumber },
      organizationName: provider.organizationName,
      ...(provider.submitterId ? { submitterIdentification: provider.submitterId } : {}),
    },
    subscriber: {
      address: { ...subscriber.address },
      dateOfBirth: subscriber.dateOfBirth,
      firstName: subscriber.firstName,
      lastName: subscriber.lastName,
      gender: subscriber.gender,
      ...(subscriber.groupNumber ? { groupNumber: subscriber.groupNumber } : {}),
      memberId: subscriber.memberId,
      paymentResponsibilityLevelCode: "P",
    },
    tradingPartnerName: payer.name,
    tradingPartnerServiceId: payer.id,
    usageIndicator: "T",
  };
};

export const buildDentalClaimPayload = (claim, { mode = getClaimsMode() } = {}) => {
  const provider = claim.billingProvider;
  const address = provider.address;
  const diagnosisCode = clean(claim.diagnosisCode).replaceAll(".", "");
  // Stedi requires a claim-level DTP*472 service date for 837D claims.
  // A date on an individual service line does not satisfy that claim edit.
  // Claim drafts already require every service line to have a date, so the
  // first line is the source of truth for the claim-level date as well.
  const claimServiceDate = compactDate(claim.serviceLines[0]?.serviceDate);
  const serviceLines = claim.serviceLines.map((line, index) => ({
    dentalService: {
      ...(diagnosisCode ? {
        compositeDiagnosisCodePointers: { diagnosisCodePointers: ["1"] },
      } : {}),
      lineItemChargeAmount: dollars(line.chargeCents),
      placeOfServiceCode: claim.placeOfServiceCode,
      procedureCode: line.code,
      procedureCount: line.units || 1,
    },
    providerControlNumber: line.providerControlNumber || `${claim.claimNumber}-${index + 1}`,
    serviceDate: compactDate(line.serviceDate),
    ...(line.toothNumber ? {
      teethInformation: [{
        toothCode: line.toothNumber,
        ...(line.toothSurfaces?.length ? { toothSurfaceCodes: line.toothSurfaces } : {}),
      }],
    } : {}),
  }));

  return {
    billing: {
      address: {
        address1: address.address1,
        ...(address.address2 ? { address2: address.address2 } : {}),
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        countryCode: address.countryCode || "US",
      },
      contactInformation: {
        name: provider.organizationName,
        phoneNumber: provider.phoneNumber,
      },
      ...(provider.taxIdType === "SSN" ? { ssn: provider.employerId } : { employerId: provider.employerId }),
      npi: provider.npi,
      ...(provider.taxIdType === "SSN"
        ? { firstName: provider.providerFirstName, lastName: provider.providerLastName }
        : { organizationName: provider.organizationName }),
      providerType: "BillingProvider",
      taxonomyCode: provider.taxonomyCode,
    },
    claimInformation: {
      benefitsAssignmentCertificationIndicator: "Y",
      claimChargeAmount: dollars(claim.totalChargeCents),
      claimDateInformation: {
        serviceDate: claimServiceDate,
      },
      claimFilingCode: claim.claimFilingCode,
      claimFrequencyCode: "1",
      ...(diagnosisCode ? {
        healthCareCodeInformation: [{ diagnosisCode, diagnosisTypeCode: "ABK" }],
      } : {}),
      patientControlNumber: claim.claimNumber,
      placeOfServiceCode: claim.placeOfServiceCode,
      planParticipationCode: "A",
      releaseInformationCode: "Y",
      serviceLines,
      signatureIndicator: "Y",
    },
    receiver: { organizationName: claim.payer.name },
    submitter: {
      contactInformation: {
        name: provider.organizationName,
        phoneNumber: provider.phoneNumber,
      },
      organizationName: provider.organizationName,
      ...(provider.submitterId ? { submitterIdentification: provider.submitterId } : {}),
    },
    subscriber: {
      address: {
        address1: claim.patient.address.address1,
        city: claim.patient.address.city,
        state: claim.patient.address.state,
        postalCode: claim.patient.address.postalCode,
        countryCode: claim.patient.address.countryCode || "US",
      },
      dateOfBirth: compactDate(claim.patient.dob),
      firstName: claim.patient.firstName,
      lastName: claim.patient.lastName,
      gender: claim.patient.gender,
      ...(claim.payer.groupNumber ? { groupNumber: claim.payer.groupNumber } : {}),
      memberId: claim.payer.memberId,
      paymentResponsibilityLevelCode: "P",
    },
    tradingPartnerName: claim.payer.name,
    tradingPartnerServiceId: claim.payer.tradingPartnerServiceId,
    // Stedi infers the environment from the API key. The JSON usage indicator
    // is optional in test mode and must not mark production claims as test data.
    ...(mode === "test" ? { usageIndicator: "T" } : {}),
  };
};

export const submitDentalClaim = async (claim) => {
  assertStediRuntimeSafety();
  const mode = getClaimsMode();
  if (String(process.env.STEDI_CLAIM_SUBMISSION_ENABLED || "").toLowerCase() !== "true") {
    throw new StediClaimError("Claim submission is disabled", {
      code: "STEDI_CLAIMS_DISABLED",
      status: 503,
    });
  }
  if (clean(claim.environment || "test").toLowerCase() !== mode) {
    throw new StediClaimError(
      `This ${claim.environment || "test"} claim draft cannot be submitted while Stedi is in ${mode} mode. Create a new draft in the active environment.`,
      {
        code: "STEDI_CLAIM_ENVIRONMENT_MISMATCH",
        status: 409,
      }
    );
  }
  if (mode === "production" && usesTestClaimFixture()) {
    throw new StediClaimError("Mock claim fixtures are not allowed in production mode", {
      code: "STEDI_PRODUCTION_MOCK_BLOCKED",
      status: 503,
    });
  }

  const apiKey = getStediApiKey("claims");
  if (!apiKey) {
    throw new StediClaimError(`Stedi ${mode} claim API key is not configured`, {
      code: "STEDI_CLAIMS_NOT_CONFIGURED",
      status: 503,
    });
  }
  const timeout = Number(process.env.STEDI_CLAIMS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  let response;
  try {
    response = await fetch(process.env.STEDI_DENTAL_CLAIMS_URL || DEFAULT_DENTAL_CLAIMS_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "Idempotency-Key": claim.idempotencyKey,
      },
      body: JSON.stringify(usesTestClaimFixture()
        ? buildTestFixtureDentalClaimPayload(claim)
        : buildDentalClaimPayload(claim, { mode })),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    throw new StediClaimError(
      error?.name === "TimeoutError" ? "Stedi claim submission timed out" : "Stedi claim submission is unavailable",
      { code: error?.name === "TimeoutError" ? "STEDI_CLAIM_TIMEOUT" : "STEDI_CLAIM_UNAVAILABLE", status: 503 }
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload.errors)
      ? payload.errors.map((item) => ({
          code: clean(item.code || item.errorCode),
          message: clean(item.message || item.description || "Stedi rejected the claim"),
        }))
      : [];
    throw new StediClaimError(payload.message || "Stedi rejected the claim", {
      code: response.status === 429 ? "STEDI_RATE_LIMITED" : "STEDI_CLAIM_REJECTED",
      status: response.status >= 500 ? 503 : 422,
      details,
    });
  }
  return payload;
};

// Backwards-compatible export for any internal callers not yet migrated.
export const submitTestDentalClaim = submitDentalClaim;
