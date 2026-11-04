import { loadSession, clearSession } from "./session.js";

export const API_BASE = import.meta.env.VITE_API_URL;

// Every Client Panel API answers in one format (see backend utils/client/apiResponse.js):
//   success: { success: true,  statusCode, message, data }
//   failure: { success: false, statusCode, code, message, errors? }
//
// api() returns the `data` of a success, and throws an ApiError for a failure:
//   err.message  – text safe to show to the user
//   err.status   – HTTP status (401, 403, 404, 409, 422, 429, ...)
//   err.code     – stable name, e.g. "INVALID_CREDENTIALS", "VALIDATION_ERROR", "SESSION_EXPIRED"
//   err.errors   – [{ field, message }] for validation failures (422)
export class ApiError extends Error {
  constructor(message, { status = 0, code = "ERROR", errors = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

// The login is no longer valid (signed out elsewhere, expired, account disabled)
const SESSION_CODES = ["SESSION_EXPIRED", "INVALID_TOKEN", "UNAUTHENTICATED", "ACCOUNT_UNAVAILABLE"];

/**
 * @param {string} path   e.g. "/patients" (relative to /api/client-panel)
 * @param {object} opts   method, body, clinicId (sent as X-Clinic-Id), token (override), auth (default true),
 *                        redirectOnExpiry (default true: a dead session sends the user to /login)
 */
export async function api(path, { method = "GET", body, clinicId, token, auth = true, redirectOnExpiry = true } = {}) {
  const jwt = token ?? (auth ? loadSession()?.token : null);
  let res;
  try {
    res = await fetch(`${API_BASE}/client-panel${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        ...(clinicId ? { "X-Clinic-Id": clinicId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please check your connection and try again.", { code: "NETWORK_ERROR" });
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload.success === false) {
    const err = new ApiError(payload.message || `Request failed (${res.status})`, {
      status: res.status,
      code: payload.code || "ERROR",
      errors: payload.errors || null,
    });
    if (auth && redirectOnExpiry && res.status === 401 && SESSION_CODES.includes(err.code)) {
      clearSession();
      window.location.assign("/login");
    }
    throw err;
  }
  return payload.data;
}
