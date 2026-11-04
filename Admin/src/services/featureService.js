import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const toFeature = (feature) => ({
  ...feature,
  id: feature._id || feature.id,
  desc: feature.description ?? feature.desc ?? "",
});

async function request(path, options = {}) {
  const token = loadAdminSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/features${path}`, {
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

export const fetchFeaturesApi = () => request("").then((rows) => rows.map(toFeature));

export const createFeatureApi = ({ name, desc }) =>
  request("", {
    method: "POST",
    body: JSON.stringify({ name, description: desc }),
  }).then(toFeature);

export const updateFeatureApi = (id, { name, desc }) =>
  request(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name, description: desc }),
  }).then(toFeature);

export const deleteFeatureApi = (id) => request(`/${id}`, { method: "DELETE" });
