import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const toCdtCode = (entry) => ({
  id: entry._id || entry.id,
  code: entry.code,
  desc: entry.description ?? entry.desc ?? "",
  pct: Number(entry.defaultCoverage ?? entry.pct ?? 0),
  freq: entry.frequency ?? entry.freq ?? "—",
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
});

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/cdt${path}`, {
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

export const fetchCdtCodesApi = () => request("").then((rows) => rows.map(toCdtCode));

export const createCdtCodeApi = ({ code, desc, pct, freq }) =>
  request("", {
    method: "POST",
    body: JSON.stringify({
      code,
      description: desc,
      defaultCoverage: pct,
      frequency: freq,
    }),
  }).then(toCdtCode);

export const updateCdtCodeApi = (id, { code, desc, pct, freq }) =>
  request(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      code,
      description: desc,
      defaultCoverage: pct,
      frequency: freq,
    }),
  }).then(toCdtCode);

export const deleteCdtCodeApi = (id) =>
  request(`/${id}`, { method: "DELETE" });
