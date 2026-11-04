import { api } from "./http.js";

export const fetchSubscriptionApi = (clinicId) =>
  api("/billing/subscription", { clinicId });
