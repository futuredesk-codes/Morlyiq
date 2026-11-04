import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const toLead = (lead) => ({
  id: lead.id || lead._id,
  name: lead.name,
  contact: lead.contact,
  source: lead.source,
  ownerId: lead.ownerId || null,
  owner: lead.owner,
  status: lead.status,
  lastActivity: lead.lastActivity || null,
  activities: [],
  createdAt: lead.createdAt,
});

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/leads${path}`, {
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

export const fetchLeadsApi = () =>
  request("").then(({ leads, owners }) => ({
    leads: leads.map(toLead),
    owners,
  }));

export const createLeadApi = ({ name, contact, source, ownerId }) =>
  request("", {
    method: "POST",
    body: JSON.stringify({
      practiceName: name,
      contactName: contact,
      source,
      ownerId,
    }),
  }).then(toLead);
