import { api } from "./http.js";

/** Every call returns the refreshed list of clinics this user can access: [{ id, name, address, role }] */
export const fetchClinicsApi = () => api("/clinics");
export const createClinicApi = (payload) => api("/clinics", { method: "POST", body: payload });
export const updateClinicApi = (clinicId, payload) => api(`/clinics/${clinicId}`, { method: "PATCH", body: payload });
export const fetchClaimProviderApi = (clinicId) => api(`/clinics/${clinicId}/claim-provider`);
export const updateClaimProviderApi = (clinicId, payload) => api(`/clinics/${clinicId}/claim-provider`, { method: "PATCH", body: payload });
export const syncClaimProviderStediApi = (clinicId) => api(`/clinics/${clinicId}/claim-provider/stedi-sync`, { method: "POST" });
export const refreshClaimProviderStediApi = (clinicId) => api(`/clinics/${clinicId}/claim-provider/stedi-refresh`, { method: "POST" });
