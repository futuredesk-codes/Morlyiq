import { api } from "./http.js";

export const fetchClaimsApi = (clinicId) => api("/claims", { clinicId });

export const fetchClaimsConfigurationApi = (clinicId) => api("/claims/configuration", { clinicId });

export const createClaimApi = (clinicId, payload) =>
  api("/claims", { method: "POST", body: payload, clinicId });

export const updateClaimApi = (clinicId, claimId, payload) =>
  api(`/claims/${claimId}`, { method: "PATCH", body: payload, clinicId });

export const validateClaimApi = (clinicId, claimId) =>
  api(`/claims/${claimId}/validate`, { method: "POST", clinicId });

export const submitClaimApi = (clinicId, claimId) =>
  api(`/claims/${claimId}/submit`, { method: "POST", clinicId });
