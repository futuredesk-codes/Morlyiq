import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

async function request(path = "", options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/audit-logs${path}`, {
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
    if (response.status === 401) clearAdminSession();
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload.data;
}

export const fetchAuditLogsApi = ({ level = "all", clientId = "all", actorId = "all", search = "", page = 1, limit = 50 } = {}) => {
  const params = new URLSearchParams({ level, clientId, actorId, page: String(page), limit: String(limit) });
  if (search.trim()) params.set("search", search.trim());
  return request(`?${params.toString()}`);
};

export const createAuditLogApi = ({ action, target, level, client }) =>
  request("", { method: "POST", body: JSON.stringify({ action, target, level, client }) });
