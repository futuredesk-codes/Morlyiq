import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const toClient = (client) => ({
  ...client,
  id: client._id || client.id,
  joined: client.createdAt ? String(client.createdAt).slice(0, 10) : "—",
  clinics: Number(client.clinics ?? 1),
  mrr: Number(client.mrr ?? 0),
  users: Number(client.users ?? 0),
  verifications: Number(client.verifications ?? 0),
  entitlements: client.entitlements || {},
});

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/clients${path}`, {
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

export const fetchClientsApi = () => request("").then((rows) => rows.map(toClient));

export const createClientApi = (client) =>
  request("", { method: "POST", body: JSON.stringify(client) }).then(toClient);

export const updateClientApi = (id, changes) =>
  request(`/${id}`, { method: "PATCH", body: JSON.stringify(changes) }).then(toClient);
