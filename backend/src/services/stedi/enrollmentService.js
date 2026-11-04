import crypto from "crypto";

const DEFAULT_BASE_URL = "https://enrollments.us.stedi.com/2024-09-01";
const DEFAULT_TIMEOUT_MS = 30_000;
const TEST_PAYER_ID = "FRCPB";
const TEST_PAYER_ALIAS = "STEDITEST";
const inFlight = new Map();

const clean = (value) => String(value || "").trim();
const digits = (value) => clean(value).replace(/\D/g, "");
const enabled = (value) => clean(value).toLowerCase() === "true";
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

export class StediEnrollmentError extends Error {
  constructor(message, { code = "STEDI_ENROLLMENT_ERROR", status = 502, details = null } = {}) {
    super(message);
    this.name = "StediEnrollmentError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const isStediAutoEnrollmentEnabled = () => enabled(process.env.STEDI_AUTO_ENROLLMENT_ENABLED);
export const isStediEnrollmentStatusRefreshConfigured = () => Boolean(clean(process.env.STEDI_ENROLLMENT_API_KEY));

const enrollmentConfig = () => {
  const payerAlias = clean(process.env.STEDI_ENROLLMENT_PAYER_ALIAS || TEST_PAYER_ALIAS).toUpperCase();
  const payerId = clean(process.env.STEDI_ENROLLMENT_PAYER_ID || TEST_PAYER_ID).toUpperCase();
  if (payerAlias !== TEST_PAYER_ALIAS || payerId !== TEST_PAYER_ID) {
    throw new StediEnrollmentError(
      "Automatic enrollment is restricted to the Stedi Test Payer",
      { code: "STEDI_ENROLLMENT_UNSAFE_PAYER", status: 503 }
    );
  }

  const apiKey = clean(process.env.STEDI_ENROLLMENT_API_KEY);
  if (!apiKey) {
    throw new StediEnrollmentError(
      "Stedi enrollment is not configured. Add a production-mode enrollment API key.",
      { code: "STEDI_ENROLLMENT_NOT_CONFIGURED", status: 503 }
    );
  }

  const parsedTimeout = Number.parseInt(process.env.STEDI_ENROLLMENT_TIMEOUT_MS, 10);
  return {
    apiKey,
    baseUrl: clean(process.env.STEDI_ENROLLMENT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, ""),
    timeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : DEFAULT_TIMEOUT_MS,
    payerAlias,
    payerId,
  };
};

const externalError = (status, payload) => {
  const message = clean(payload?.message || payload?.error || `Stedi enrollment request failed (${status})`);
  if (status === 401 || status === 403) {
    return new StediEnrollmentError(
      "Stedi rejected the enrollment credential. Use a production-mode API key with enrollment access.",
      { code: "STEDI_ENROLLMENT_CREDENTIAL_REJECTED", status: 503 }
    );
  }
  if (status === 409) {
    if (/another Stedi account/i.test(message)) {
      return new StediEnrollmentError(
        "This NPI/EIN or 835 enrollment belongs to another Stedi account. Use the API key for that account, or contact Stedi to transfer/release the enrollment.",
        { code: "STEDI_ENROLLMENT_OTHER_ACCOUNT", status: 409, details: payload }
      );
    }
    return new StediEnrollmentError(message, { code: "STEDI_ENROLLMENT_CONFLICT", status: 409, details: payload });
  }
  if (status === 429) {
    return new StediEnrollmentError("Stedi enrollment rate limit reached. Try again shortly.", {
      code: "STEDI_ENROLLMENT_RATE_LIMITED",
      status: 429,
    });
  }
  if (status >= 500) {
    return new StediEnrollmentError("Stedi enrollment service is temporarily unavailable.", {
      code: "STEDI_ENROLLMENT_UNAVAILABLE",
      status: 503,
    });
  }
  if (status === 400 || status === 422) {
    return new StediEnrollmentError(
      "Stedi rejected the provider or enrollment details. Review the clinic setup and retry.",
      {
        code: clean(payload?.code || "STEDI_ENROLLMENT_VALIDATION_FAILED").toUpperCase(),
        status: 422,
        details: payload,
      }
    );
  }
  return new StediEnrollmentError(message, {
    code: clean(payload?.code || "STEDI_ENROLLMENT_REJECTED").toUpperCase(),
    status: status >= 400 && status < 500 ? status : 502,
    details: payload,
  });
};

const request = async (path, { method = "GET", body } = {}) => {
  const config = enrollmentConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  let response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: config.apiKey,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new StediEnrollmentError("Stedi enrollment request timed out. Retry the sync.", {
        code: "STEDI_ENROLLMENT_TIMEOUT",
        status: 504,
      });
    }
    throw new StediEnrollmentError("Could not reach the Stedi enrollment service.", {
      code: "STEDI_ENROLLMENT_NETWORK_ERROR",
      status: 503,
    });
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw externalError(response.status, payload);
  return payload;
};

const identityFingerprint = (provider) =>
  crypto.createHash("sha256").update(`${provider.npi}:${provider.taxIdType}:${provider.employerId}`).digest("hex");

const contactFromProvider = (provider) => ({
  organizationName: provider.contactOrganizationName || provider.organizationName,
  email: provider.enrollmentContactEmail,
  phone: provider.phoneNumber,
  country: provider.countryCode || "US",
  streetAddress1: provider.address1,
  ...(provider.address2 ? { streetAddress2: provider.address2 } : {}),
  city: provider.city,
  state: provider.state,
  zipCode: provider.postalCode,
});

const providerPayload = (provider) => ({
  name: provider.organizationName,
  npi: provider.npi,
  taxId: provider.employerId,
  taxIdType: provider.taxIdType,
  contacts: [contactFromProvider(provider)],
});

// Stedi's provider update endpoint accepts the mutable provider fields only.
// NPI and tax ID are immutable after provider creation.
const providerUpdatePayload = (provider) => ({
  name: provider.organizationName,
  contacts: [contactFromProvider(provider)],
});

const validateProvider = (provider) => {
  const errors = [];
  if (!provider.organizationName) errors.push("provider organization name");
  if (!validNpi(provider.npi)) errors.push("valid 10-digit NPI");
  if (!["EIN", "SSN"].includes(provider.taxIdType)) errors.push("EIN or SSN tax ID type");
  if (!/^\d{9}$/.test(provider.employerId)) errors.push(`9-digit ${provider.taxIdType === "SSN" ? "SSN" : "EIN"}`);
  if (provider.taxIdType === "SSN" && !provider.providerFirstName) errors.push("individual provider first name");
  if (provider.taxIdType === "SSN" && !provider.providerLastName) errors.push("individual provider last name");
  if (provider.contactType !== "organization") errors.push("organization contact type");
  if (!provider.contactOrganizationName) errors.push("contact organization name");
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(provider.phoneNumber)) errors.push("valid US phone number");
  if (!provider.address1) errors.push("street address");
  if (!provider.city) errors.push("city");
  if (!/^[A-Z]{2}$/.test(provider.state)) errors.push("2-letter state");
  if (!["US", "CA"].includes(provider.countryCode)) errors.push("US or CA country code");
  const validPostalCode = provider.countryCode === "CA"
    ? /^[A-Z]\d[A-Z][ -]?\d[A-Z]\d$/.test(provider.postalCode.toUpperCase())
    : /^\d{5}(-\d{4})?$/.test(provider.postalCode);
  if (!validPostalCode) errors.push("valid ZIP/postal code");
  if (!/^\S+@\S+\.\S+$/.test(provider.enrollmentContactEmail)) errors.push("enrollment contact email");
  if (errors.length) {
    throw new StediEnrollmentError(`Complete the clinic provider setup: ${errors.join(", ")}`, {
      code: "STEDI_PROVIDER_SETUP_INCOMPLETE",
      status: 422,
    });
  }
};

const exactProvider = (items, provider) =>
  (items || []).find((item) =>
    digits(item?.npi) === provider.npi
    && digits(item?.taxId) === provider.employerId
    && clean(item?.taxIdType).toUpperCase() === provider.taxIdType
  );

const findProvider = async (provider) => {
  const params = new URLSearchParams({ pageSize: "100" });
  params.append("providerNpis", provider.npi);
  params.append("providerTaxIds", provider.employerId);
  const result = await request(`/providers?${params.toString()}`);
  return exactProvider(result?.items, provider) || null;
};

const retrieveProvider = async (providerId) => {
  try {
    return await request(`/providers/${encodeURIComponent(providerId)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const resolveProvider = async (clinic, provider, fingerprint) => {
  const stored = clinic.stediEnrollment || {};
  let stediProvider = null;

  if (stored.providerId && stored.identityFingerprint === fingerprint) {
    stediProvider = await retrieveProvider(stored.providerId);
  }
  if (!stediProvider) stediProvider = await findProvider(provider);

  if (stediProvider) {
    // Update is a full replacement in Stedi. NPI/TIN remain unchanged; contact
    // and display details stay aligned with the latest clinic setup.
    return request(`/providers/${encodeURIComponent(stediProvider.id)}`, {
      method: "POST",
      body: providerUpdatePayload(provider),
    });
  }

  return request("/providers", { method: "POST", body: providerPayload(provider) });
};

const listEnrollments = async (providerId, payerId) => {
  const params = new URLSearchParams({ pageSize: "100" });
  params.append("providerIds", providerId);
  params.append("payerIds", payerId);
  params.append("transactions", "claimPayment");
  const result = await request(`/enrollments?${params.toString()}`);
  return Array.isArray(result?.items) ? result.items : [];
};

const retrieveEnrollment = async (enrollmentId) => {
  try {
    return await request(`/enrollments/${encodeURIComponent(enrollmentId)}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

const enrollmentStatusPriority = (value) => {
  const status = clean(value).toUpperCase();
  if (status === "LIVE") return 100;
  if (status === "PROVISIONING") return 80;
  if (status === "PROVIDER_ACTION_REQUIRED") return 70;
  if (status === "STEDI_ACTION_REQUIRED") return 60;
  if (status === "DRAFT") return 50;
  if (["CANCELED", "REJECTED"].includes(status)) return 0;
  return 40;
};

const selectEnrollment = (items) => {
  const ordered = [...items].sort((a, b) => {
    const statusDifference = enrollmentStatusPriority(b?.status) - enrollmentStatusPriority(a?.status);
    if (statusDifference) return statusDifference;
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });
  return ordered.find((item) => !["CANCELED", "REJECTED"].includes(clean(item.status).toUpperCase())) || ordered[0] || null;
};

const applyEnrollmentStatus = (clinic, enrollment) => {
  const status = clean(enrollment?.status).toUpperCase();
  const terminalFailure = ["REJECTED", "CANCELED"].includes(status);
  clinic.stediEnrollment.enrollmentStatus = status;
  clinic.stediEnrollment.syncStatus = status === "LIVE" ? "live" : terminalFailure ? "error" : "submitted";
  clinic.stediEnrollment.enrollmentCheckedAt = new Date();
  clinic.stediEnrollment.errorCode = terminalFailure ? `STEDI_ENROLLMENT_${status}` : "";
  clinic.stediEnrollment.errorMessage = terminalFailure
    ? clean(enrollment?.reason || `Stedi enrollment is ${status.toLowerCase()}`)
    : "";
};

const resolveEnrollment = async (clinic, provider, stediProvider, config) => {
  const storedId = clean(clinic.stediEnrollment?.enrollmentId);
  // Always reconcile the provider's matching enrollments before trusting the
  // cached ID. A provider can have an older action-required record while a
  // newer enrollment is already LIVE in the Stedi portal.
  let enrollment = selectEnrollment(await listEnrollments(stediProvider.id, config.payerId));
  if (!enrollment && storedId) enrollment = await retrieveEnrollment(storedId);
  if (enrollment) return enrollment;

  return request("/enrollments", {
    method: "POST",
    body: {
      payer: { idOrAlias: config.payerAlias },
      primaryContact: contactFromProvider(provider),
      provider: { id: stediProvider.id },
      status: "STEDI_ACTION_REQUIRED",
      transactions: { claimPayment: { enroll: true } },
      userEmail: provider.enrollmentContactEmail,
    },
  });
};

const saveFailure = async (clinic, error) => {
  clinic.stediEnrollment = {
    ...(clinic.stediEnrollment?.toObject?.() || clinic.stediEnrollment || {}),
    payerId: TEST_PAYER_ID,
    payerAlias: TEST_PAYER_ALIAS,
    transaction: "claimPayment",
    syncStatus: "error",
    lastAttemptAt: new Date(),
    errorCode: error.code || "STEDI_ENROLLMENT_ERROR",
    errorMessage: error.message || "Stedi enrollment sync failed",
  };
  await clinic.save();
};

const performSync = async (clinic) => {
  if (!isStediAutoEnrollmentEnabled()) {
    throw new StediEnrollmentError("Automatic Stedi enrollment is disabled", {
      code: "STEDI_AUTO_ENROLLMENT_DISABLED",
      status: 503,
    });
  }

  const config = enrollmentConfig();
  const provider = {
    organizationName: clean(clinic.claimProvider?.organizationName || clinic.name),
    providerType: clean(clinic.claimProvider?.providerType || "organization").toLowerCase(),
    providerFirstName: clean(clinic.claimProvider?.providerFirstName),
    providerLastName: clean(clinic.claimProvider?.providerLastName),
    npi: digits(clinic.claimProvider?.npi),
    taxIdType: clean(clinic.claimProvider?.taxIdType || "EIN").toUpperCase(),
    employerId: digits(clinic.claimProvider?.employerId),
    contactType: clean(clinic.claimProvider?.contactType || "organization").toLowerCase(),
    contactOrganizationName: clean(clinic.claimProvider?.contactOrganizationName || clinic.claimProvider?.organizationName || clinic.name),
    phoneNumber: digits(clinic.claimProvider?.phoneNumber),
    address1: clean(clinic.claimProvider?.address1),
    address2: clean(clinic.claimProvider?.address2),
    city: clean(clinic.claimProvider?.city),
    state: clean(clinic.claimProvider?.state).toUpperCase(),
    postalCode: clean(clinic.claimProvider?.postalCode),
    countryCode: clean(clinic.claimProvider?.countryCode || "US").toUpperCase(),
    enrollmentContactEmail: clean(clinic.claimProvider?.enrollmentContactEmail).toLowerCase(),
  };
  const fingerprint = identityFingerprint(provider);
  validateProvider(provider);

  clinic.stediEnrollment = {
    ...(clinic.stediEnrollment?.toObject?.() || clinic.stediEnrollment || {}),
    payerId: config.payerId,
    payerAlias: config.payerAlias,
    transaction: "claimPayment",
    syncStatus: "syncing",
    lastAttemptAt: new Date(),
    errorCode: "",
    errorMessage: "",
  };
  await clinic.save();

  try {
    const previousProviderId = clean(clinic.stediEnrollment?.providerId);
    const previousFingerprint = clean(clinic.stediEnrollment?.identityFingerprint);
    const stediProvider = await resolveProvider(clinic, provider, fingerprint);
    if ((previousProviderId && previousProviderId !== stediProvider.id) || (previousFingerprint && previousFingerprint !== fingerprint)) {
      clinic.stediEnrollment.enrollmentId = "";
      clinic.stediEnrollment.enrollmentStatus = "";
    }
    clinic.stediEnrollment.providerId = stediProvider.id;
    clinic.stediEnrollment.identityFingerprint = fingerprint;
    clinic.stediEnrollment.providerSyncedAt = new Date();
    await clinic.save();

    const enrollment = await resolveEnrollment(clinic, provider, stediProvider, config);
    clinic.stediEnrollment.enrollmentId = enrollment.id;
    applyEnrollmentStatus(clinic, enrollment);
    await clinic.save();
    return clinic.stediEnrollment;
  } catch (error) {
    await saveFailure(clinic, error);
    throw error;
  }
};

export const syncClinicStediEnrollment = async (clinic) => {
  const key = `${clinic.tenantId}:${clinic.clinicId}`;
  const previous = inFlight.get(key);
  let operation;
  operation = Promise.resolve(previous)
    .catch(() => undefined)
    .then(() => performSync(clinic))
    .finally(() => {
      if (inFlight.get(key) === operation) inFlight.delete(key);
    });
  inFlight.set(key, operation);
  return operation;
};

const performRefresh = async (clinic, { preserveStatusOnError = false } = {}) => {
  const enrollmentId = clean(clinic.stediEnrollment?.enrollmentId);
  if (!enrollmentId) {
    throw new StediEnrollmentError("No Stedi enrollment is linked to this clinic yet", {
      code: "STEDI_ENROLLMENT_NOT_LINKED",
      status: 409,
    });
  }
  try {
    const providerId = clean(clinic.stediEnrollment?.providerId);
    const payerId = clean(clinic.stediEnrollment?.payerId || TEST_PAYER_ID).toUpperCase();
    // Re-list matching enrollments so a LIVE record created/advanced in the
    // portal replaces a stale cached action-required enrollment ID.
    let enrollment = providerId
      ? selectEnrollment(await listEnrollments(providerId, payerId))
      : null;
    if (!enrollment) enrollment = await retrieveEnrollment(enrollmentId);
    if (!enrollment) {
      throw new StediEnrollmentError("The linked Stedi enrollment could not be found", {
        code: "STEDI_ENROLLMENT_NOT_FOUND",
        status: 404,
      });
    }
    clinic.stediEnrollment.enrollmentId = enrollment.id;
    applyEnrollmentStatus(clinic, enrollment);
    await clinic.save();
    return clinic.stediEnrollment;
  } catch (error) {
    // Automatic page/session refresh must not replace a valid last-known
    // status merely because Stedi had a transient timeout. Explicit refreshes
    // still surface and persist their failure as before.
    if (!preserveStatusOnError) await saveFailure(clinic, error);
    throw error;
  }
};

export const refreshClinicStediEnrollment = async (clinic, options = {}) => {
  const key = `${clinic.tenantId}:${clinic.clinicId}`;
  const previous = inFlight.get(key);
  let operation;
  operation = Promise.resolve(previous)
    .catch(() => undefined)
    .then(() => performRefresh(clinic, options))
    .finally(() => {
      if (inFlight.get(key) === operation) inFlight.delete(key);
    });
  inFlight.set(key, operation);
  return operation;
};
