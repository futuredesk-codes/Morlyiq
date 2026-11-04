import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/users${path}`, {
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

export const fetchUsersApi = () => request("");
export const fetchClientUserOptionsApi = (tenantId) =>
  request(`/client-users?tenantId=${encodeURIComponent(tenantId)}`);
export const inviteUserApi = (user) => request("", { method: "POST", body: JSON.stringify(user) });
export const resendUserInvitationApi = (id) => request(`/${id}/resend-invitation`, { method: "POST" });
export const updateUserApi = (id, changes) => request(`/${id}`, { method: "PATCH", body: JSON.stringify(changes) });
