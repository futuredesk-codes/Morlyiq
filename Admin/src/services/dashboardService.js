import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

export async function fetchAdminDashboardStatsApi() {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/dashboard/stats`, {
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
