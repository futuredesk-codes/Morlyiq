import { api } from "./http.js";

/** Read-only sandbox status for the active clinic's patient payers. */
export const fetchInsuranceConnectionsApi = (clinicId) =>
  api("/insurance-connections", { clinicId });
