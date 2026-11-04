import {
  assertStediRuntimeSafety,
  getEraMode,
  getStediApiKey,
} from "../../config/stediRuntime.js";

const DEFAULT_TRANSACTIONS_URL = "https://core.us.stedi.com/2023-08-01/transactions";
const DEFAULT_REPORT_BASE_URL = "https://healthcare.us.stedi.com/2024-04-01/change/medicalnetwork/reports/v2";
const DEFAULT_PDF_BASE_URL = "https://healthcare.us.stedi.com/2024-04-01/electronic-remittance-advice";
const DEFAULT_TIMEOUT_MS = 30_000;

export class StediEraError extends Error {
  constructor(message, { code = "STEDI_ERA_ERROR", status = 502 } = {}) {
    super(message);
    this.name = "StediEraError";
    this.code = code;
    this.status = status;
  }
}

const clean = (value) => String(value || "").trim();

const config = () => {
  assertStediRuntimeSafety();
  const mode = getEraMode();
  const apiKey = getStediApiKey("era");
  if (!apiKey) {
    throw new StediEraError(`Stedi ${mode} ERA API key is not configured`, {
      code: "STEDI_ERA_NOT_CONFIGURED",
      status: 503,
    });
  }
  return {
    mode,
    apiKey,
    timeout: Number(process.env.STEDI_ERA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    transactionsUrl: clean(process.env.STEDI_ERA_TRANSACTIONS_URL || DEFAULT_TRANSACTIONS_URL),
    reportBaseUrl: clean(process.env.STEDI_ERA_REPORT_BASE_URL || DEFAULT_REPORT_BASE_URL).replace(/\/$/, ""),
    pdfBaseUrl: clean(process.env.STEDI_ERA_PDF_BASE_URL || DEFAULT_PDF_BASE_URL).replace(/\/$/, ""),
  };
};

const request = async (url, { accept = "application/json" } = {}) => {
  const { apiKey, timeout } = config();
  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: apiKey,
        Accept: accept,
        ...(accept === "application/json" ? { "Accept-Encoding": "gzip" } : {}),
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
  } catch (error) {
    const timedOut = error?.name === "TimeoutError";
    throw new StediEraError(timedOut ? "Stedi ERA request timed out" : "Stedi ERA service is unavailable", {
      code: timedOut ? "STEDI_ERA_TIMEOUT" : "STEDI_ERA_UNAVAILABLE",
      status: 503,
    });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new StediEraError(payload.message || `Stedi ERA request failed (${response.status})`, {
      code: response.status === 404
        ? "STEDI_ERA_NOT_FOUND"
        : response.status === 429
          ? "STEDI_RATE_LIMITED"
          : response.status === 401 || response.status === 403
            ? "STEDI_ERA_CREDENTIALS_INVALID"
            : "STEDI_ERA_REQUEST_FAILED",
      status: response.status === 404 ? 404 : response.status === 429 ? 429 : response.status >= 500 ? 503 : 502,
    });
  }
  return response;
};

export const listEraTransactions = async () => {
  const { transactionsUrl, mode } = config();
  const pageSize = Math.min(100, Math.max(1, Number(process.env.STEDI_ERA_LIST_LIMIT) || 50));
  const url = new URL(transactionsUrl);
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("transactionSetId", "835");
  url.searchParams.set("direction", "INBOUND");
  url.searchParams.set("mode", mode);
  url.searchParams.set("status", "succeeded");
  const response = await request(url);
  const payload = await response.json();
  return Array.isArray(payload.items) ? payload.items : [];
};

// Backwards-compatible export for any internal callers not yet migrated.
export const listTestEraTransactions = listEraTransactions;

export const retrieveEraReport = async (transactionId) => {
  const { reportBaseUrl } = config();
  const response = await request(`${reportBaseUrl}/${encodeURIComponent(transactionId)}/835`);
  return response.json();
};

export const retrieveEraPdf = async (transactionId) => {
  const { pdfBaseUrl } = config();
  const response = await request(`${pdfBaseUrl}/${encodeURIComponent(transactionId)}/pdf`, { accept: "application/pdf" });
  const contentType = clean(response.headers.get("content-type"));
  if (!contentType.toLowerCase().includes("application/pdf")) {
    throw new StediEraError("Stedi did not return an ERA PDF", { code: "STEDI_ERA_PDF_INVALID", status: 502 });
  }
  return Buffer.from(await response.arrayBuffer());
};

