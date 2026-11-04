import { api } from "./http.js";

/** Global read-only CDT catalogue maintained by the Super Admin. */
export const fetchCdtCodesApi = () => api("/cdt");
