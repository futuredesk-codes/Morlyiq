import { api } from "./http.js";

const pathFor = (token, suffix = "") => `/onboarding/${encodeURIComponent(token)}${suffix}`;

export const getOnboardingApi = (token) => api(pathFor(token), { auth: false });

export const startOnboardingCheckoutApi = (token) =>
  api(pathFor(token, "/checkout"), { method: "POST", body: {}, auth: false });

export const confirmOnboardingPaymentApi = (token, sessionId) =>
  api(pathFor(token, "/confirm-payment"), { method: "POST", body: { sessionId }, auth: false });

export const createOnboardingPasswordApi = (token, password, confirmPassword) =>
  api(pathFor(token, "/password"), { method: "POST", body: { password, confirmPassword }, auth: false });
