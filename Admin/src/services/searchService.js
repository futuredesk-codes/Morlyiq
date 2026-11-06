import { clearAdminSession, loadAdminSession } from "./session.js";

export async function searchAdminApi(query, signal) {
  const token = loadAdminSession()?.token;
  const response = await fetch(`${import.meta.env.VITE_API_URL}/search?q=${encodeURIComponent(query)}`, {
    signal,
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (response.status === 401) clearAdminSession();
    throw new Error(payload.message || "Search is unavailable. Please try again.");
  }
  return payload.data.results;
}
