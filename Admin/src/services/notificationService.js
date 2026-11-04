import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const request = async (path, options = {}) => {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/notifications${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new Error("Cannot reach the server. Please check your connection and try again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    if (response.status === 401) clearAdminSession();
    const error = new Error(payload.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.code = payload.code || "ERROR";
    throw error;
  }
  return payload.data;
};

export const fetchAdminNotificationsApi = (limit = 30) => request(`/?limit=${limit}`);
export const markAdminNotificationReadApi = (id) => request(`/${id}/read`, { method: "PATCH" });
export const markAllAdminNotificationsReadApi = () => request("/read-all", { method: "POST" });
