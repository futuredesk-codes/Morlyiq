import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/insurers${path}`, {
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

export const fetchInsurersApi = () =>
  request("").then((data) => data.insurers || []);

export const fetchInsurerDirectoryApi = () => request("/directory");

export const createInsurerApi = ({ stediId, status }) =>
  request("", {
    method: "POST",
    body: JSON.stringify({ stediId, status }),
  });

export const updateInsurerStatusApi = (id, status) =>
  request(`/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
