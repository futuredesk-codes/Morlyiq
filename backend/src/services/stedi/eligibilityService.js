import { STEDI_TEST_ELIGIBILITY_FIXTURE } from "../../config/stediTestEligibilityFixture.js";
import { getStediApiKey } from "../../config/stediRuntime.js";

const DEFAULT_ELIGIBILITY_URL = "https://healthcare.us.stedi.com/2026-06-01/eligibility-check";
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class StediEligibilityError extends Error {
  constructor(message, { code = "STEDI_ELIGIBILITY_ERROR", status = 502 } = {}) {
    super(message);
    this.name = "StediEligibilityError";
    this.code = code;
    this.status = status;
  }
}

const clean = (value) => String(value || "").trim();
const enabled = (value) => clean(value).toLowerCase() === "true";
const firstValue = (...values) => values.find((value) => value !== undefined && value !== null && value !== "") ?? null;

const patientName = (fullName) => {
  const parts = clean(fullName).split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return { firstName: parts[0] || "Unknown", lastName: parts[0] || "Unknown" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
};

const personName = (fullName) => ({ person: patientName(fullName) });

const policyServices = (patient) => {
  const cdtCodes = (patient.codes || [])
    .map((code) => clean(code).toUpperCase())
    .filter((code) => /^D\d{4}$/.test(code))
    .slice(0, 10)
    .map((value) => ({ system: "CDT", value }));
  return [{ system: "STC", value: "35" }, ...cdtCodes];
};

export const usesTestEligibilityFixture = () => enabled(process.env.STEDI_ELIGIBILITY_MOCK_ENABLED);

const matchesTestEligibilityFixture = (patient, policy) => {
  const fixture = STEDI_TEST_ELIGIBILITY_FIXTURE;
  return clean(patient.name).toLowerCase() === fixture.subscriber.fullName.toLowerCase()
    && clean(patient.dob) === fixture.subscriber.dateOfBirth
    && clean(policy.subscriberId) === fixture.subscriber.memberId
    && clean(policy.tradingPartnerServiceId) === fixture.payer.id;
};

export const buildEligibilityPayload = ({ patient, policy, provider, policyType }) => {
  if (usesTestEligibilityFixture() && policyType === "primary" && matchesTestEligibilityFixture(patient, policy)) {
    const fixture = STEDI_TEST_ELIGIBILITY_FIXTURE;
    return {
      payerId: fixture.payer.id,
      externalPatientId: String(patient._id || patient.id).slice(0, 36),
      provider: {
        name: { organization: fixture.provider.organizationName },
        npi: fixture.provider.npi,
      },
      subscriber: {
        memberId: fixture.subscriber.memberId,
        dateOfBirth: fixture.subscriber.dateOfBirth,
        name: {
          person: {
            firstName: fixture.subscriber.firstName,
            lastName: fixture.subscriber.lastName,
          },
        },
      },
      encounter: { services: fixture.encounter.services.map((service) => ({ ...service })) },
    };
  }
  const payload = {
    payerId: clean(policy.tradingPartnerServiceId),
    externalPatientId: String(patient._id || patient.id).slice(0, 36),
    provider: {
      name: { organization: clean(provider.organizationName).slice(0, 60) },
      npi: clean(provider.npi),
    },
    subscriber: {
      memberId: clean(policy.subscriberId),
    },
    encounter: { services: policyServices(patient) },
  };

  // Primary policies predate relationship capture and are treated as self.
  // For a non-self secondary subscriber, the patient is sent as the dependent.
  if (policyType === "secondary" && policy.relationship && policy.relationship !== "Self") {
    payload.dependent = {
      dateOfBirth: patient.dob,
      name: personName(patient.name),
    };
  } else {
    payload.subscriber.dateOfBirth = patient.dob;
    payload.subscriber.name = personName(patient.name);
  }

  return payload;
};

const responseMessage = (body, fallback) => {
  if (!body || typeof body !== "object") return fallback;
  return clean(body.message || body.error || body.detail || body.title) || fallback;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendRequest = async (payload, attempt = 0) => {
  const apiKey = getStediApiKey("eligibility");
  if (!apiKey) {
    throw new StediEligibilityError("Stedi eligibility is not configured", {
      code: "STEDI_ELIGIBILITY_NOT_CONFIGURED",
      status: 503,
    });
  }

  const timeout = Number(process.env.STEDI_ELIGIBILITY_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
  let response;
  try {
    response = await fetch(process.env.STEDI_ELIGIBILITY_URL || DEFAULT_ELIGIBILITY_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    throw new StediEligibilityError(
      timedOut ? "Stedi eligibility request timed out" : "Stedi eligibility service could not be reached",
      { code: timedOut ? "STEDI_ELIGIBILITY_TIMEOUT" : "STEDI_ELIGIBILITY_UNAVAILABLE", status: 503 }
    );
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (attempt === 0 && RETRYABLE_STATUS.has(response.status)) {
      await wait(500);
      return sendRequest(payload, 1);
    }
    const safeStatus = response.status === 401 || response.status === 403 ? 503 : response.status;
    const safeMessage = response.status === 401 || response.status === 403
      ? "Stedi eligibility credentials were rejected"
      : responseMessage(body, "Stedi eligibility request failed");
    throw new StediEligibilityError(safeMessage, {
      code: response.status === 429 ? "STEDI_RATE_LIMITED" : "STEDI_ELIGIBILITY_REJECTED",
      status: safeStatus >= 400 && safeStatus < 600 ? safeStatus : 502,
    });
  }
  return body || {};
};

const organizationName = (entity) => firstValue(
  entity?.name?.organization,
  entity?.name,
  entity?.organizationName
);

const normalizeProblem = (problem) => ({
  code: clean(firstValue(problem?.code, problem?.errorCode, problem?.rejectReasonCode, problem?.reasonCode)),
  message: clean(firstValue(
    problem?.message,
    problem?.description,
    problem?.reason,
    problem?.rejectReason,
    problem?.followupAction
  )) || "The payer returned an eligibility issue",
});

const normalizeBenefit = (category, benefit, planIndex) => ({
  category,
  planIndex,
  service: {
    system: clean(benefit?.service?.system),
    code: clean(benefit?.service?.value),
    description: clean(firstValue(benefit?.service?.definition, benefit?.service?.description)),
  },
  coverageLevel: clean(benefit?.coverageLevel),
  network: clean(firstValue(benefit?.network?.indicator, benefit?.network)),
  timePeriod: clean(firstValue(benefit?.timePeriod, benefit?.timeQualifier)),
  amount: firstValue(benefit?.amount, benefit?.benefitAmount),
  percent: firstValue(benefit?.percent, benefit?.benefitPercent),
  quantity: firstValue(benefit?.quantity, benefit?.benefitQuantity),
  authorizationRequired: firstValue(benefit?.authorizationRequired, benefit?.preAuthorizationRequired),
  messages: [
    ...(Array.isArray(benefit?.messages) ? benefit.messages : []),
    ...(Array.isArray(benefit?.additionalInformation)
      ? benefit.additionalInformation.map((item) => item?.description).filter(Boolean)
      : []),
  ].map(clean).filter(Boolean).slice(0, 10),
});

const flattenBenefits = (plans) => {
  const rows = [];
  plans.forEach((plan, planIndex) => {
    Object.entries(plan?.benefits || {}).forEach(([category, items]) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => rows.push(normalizeBenefit(category, item, planIndex)));
    });
  });
  // A 271 can contain hundreds of repetitive EB segments. Bound the safe
  // snapshot stored and returned while preserving the payer's response order.
  return { rows: rows.slice(0, 500), total: rows.length };
};

const statusRows = (plans) => plans.flatMap((plan) => Array.isArray(plan?.benefits?.statuses) ? plan.benefits.statuses : []);

const statusLabel = (status) => clean(firstValue(status?.status, status?.coverageStatus, status?.name));

const coverageSummary = (plans) => {
  const statuses = statusRows(plans);
  const active = statuses.find((item) => /active/i.test(statusLabel(item)));
  const selected = active || statuses[0] || {};
  return {
    status: statusLabel(selected) || "UNKNOWN",
    network: clean(firstValue(selected?.network?.indicator, selected?.network)) || "NOT_RETURNED",
    planName: clean(firstValue(
      plans[0]?.name,
      plans[0]?.planName,
      selected?.planName,
      selected?.insuranceType,
      selected?.messages?.[0]
    )),
    startDate: firstValue(selected?.dates?.plan?.start, selected?.dates?.eligibility?.start, plans[0]?.dates?.plan?.start),
    endDate: firstValue(selected?.dates?.plan?.end, selected?.dates?.eligibility?.end, plans[0]?.dates?.plan?.end),
  };
};

export const normalizeEligibilityResponse = ({ response, policy, policyType }) => {
  const plans = Array.isArray(response?.plans) ? response.plans : [];
  const errors = (Array.isArray(response?.errors) ? response.errors : []).map(normalizeProblem);
  const warnings = (Array.isArray(response?.warnings) ? response.warnings : []).map(normalizeProblem);
  const flattenedBenefits = flattenBenefits(plans);
  return {
    policyType,
    outcome: errors.length ? "rejected" : "completed",
    payer: {
      name: clean(organizationName(response?.payer) || policy.payer),
      payerId: clean(response?.payerId || response?.payer?.identification || policy.tradingPartnerServiceId),
    },
    memberIdLast4: clean(policy.subscriberId).slice(-4),
    relationship: policy.relationship || "Self",
    stediCheckId: clean(response?.id),
    eligibilitySearchId: clean(response?.eligibilitySearchId),
    coverage: coverageSummary(plans),
    benefits: flattenedBenefits.rows,
    benefitRowCount: flattenedBenefits.total,
    benefitsTruncated: flattenedBenefits.total > flattenedBenefits.rows.length,
    errors,
    warnings,
    checkedAt: new Date().toISOString(),
  };
};

export const failedPolicyResult = ({ policy, policyType, error }) => ({
  policyType,
  outcome: "failed",
  payer: { name: clean(policy?.payer), payerId: clean(policy?.tradingPartnerServiceId) },
  memberIdLast4: clean(policy?.subscriberId).slice(-4),
  relationship: policy?.relationship || "Self",
  stediCheckId: "",
  eligibilitySearchId: "",
  coverage: { status: "UNKNOWN", network: "NOT_RETURNED", planName: "", startDate: null, endDate: null },
  benefits: [],
  benefitRowCount: 0,
  benefitsTruncated: false,
  errors: [{ code: error?.code || "STEDI_ELIGIBILITY_ERROR", message: error?.message || "Eligibility check failed" }],
  warnings: [],
  checkedAt: new Date().toISOString(),
});

export const runPolicyEligibility = async ({ patient, policy, provider, policyType }) => {
  const payload = buildEligibilityPayload({ patient, policy, provider, policyType });
  const response = await sendRequest(payload);
  return normalizeEligibilityResponse({ response, policy, policyType });
};
