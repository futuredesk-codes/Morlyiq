import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/settings${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (response.status === 401 && payload.code !== "INVALID_PASSWORD") clearAdminSession();
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.code = payload.code || "ERROR";
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export const fetchPlatformSettingsApi = () => request("");

export const updateSuperAdminMfaApi = ({ enabled, password }) => request("/security/super-admin-mfa", {
  method: "PUT",
  body: JSON.stringify({ enabled, password }),
});
