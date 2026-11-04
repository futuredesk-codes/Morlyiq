import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchReportOverviewApi({ range = "30d", clientId = "" } = {}) {
  const token = loadAdminSession()?.token;
  const query = new URLSearchParams({ range });
  if (clientId) query.set("clientId", clientId);

  let response;
  try {
    response = await fetch(`${API_BASE}/reports/overview?${query.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
