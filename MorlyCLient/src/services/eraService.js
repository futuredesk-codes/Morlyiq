import { API_BASE, ApiError, api } from "./http.js";
import { loadSession } from "./session.js";

export const fetchErasApi = (clinicId) => api("/eras", { clinicId });

export const fetchEraPdfApi = async (clinicId, transactionId) => {
  const token = loadSession()?.token;
  let response;
  try {
    response = await fetch(`${API_BASE}/client-panel/eras/${encodeURIComponent(transactionId)}/pdf`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(clinicId ? { "X-Clinic-Id": clinicId } : {}),
        Accept: "application/pdf",
      },
    });
  } catch {
    throw new ApiError("Cannot reach the server. Please check your connection and try again.", { code: "NETWORK_ERROR" });
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.message || `ERA PDF request failed (${response.status})`, {
      status: response.status,
      code: payload.code || "ERA_PDF_ERROR",
    });
  }
  return response.blob();
};

