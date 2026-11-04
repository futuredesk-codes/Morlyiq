import { api } from "./http.js";

/** Authenticated dental payer directory, served from the backend's daily Stedi cache. */
export const fetchDentalPayersApi = () => api("/payers");
