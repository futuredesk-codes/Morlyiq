import { api } from "./http.js";

// Password
/** -> { signedOutOtherDevices } */
export const changePasswordApi = (currentPassword, newPassword) =>
  api("/account/password", { method: "POST", body: { currentPassword, newPassword } });

// MFA (6-digit code emailed at login)
/** -> { enabled, email (masked), policyRequired (the practice requires MFA, so it can't be turned off) } */
export const mfaStatusApi = () => api("/account/mfa");
/** On/off switch (needs the account password) -> { enabled }. While on, every sign-in needs a code emailed to the user. */
export const mfaSetApi = (enabled, password) => api("/account/mfa", { method: "PUT", body: { enabled, password } });

// Practice policy (Owner only)
/** -> { requireMfa } */
export const fetchPolicyApi = () => api("/account/policy");
/** While on, every staff member must sign in with an emailed code and cannot turn MFA off -> { requireMfa } */
export const setPolicyApi = (requireMfa) => api("/account/policy", { method: "PUT", body: { requireMfa } });

// Activity log (Owner only)
/** -> [{ id, ts (ISO), actor, action, target }] newest first. `before` (an ISO date) loads the next page. */
export const fetchActivityApi = ({ limit = 100, before } = {}) =>
  api(`/activity?limit=${limit}${before ? `&before=${encodeURIComponent(before)}` : ""}`);

// Active sessions (this user's devices)
/** -> [{ id, device, ip, signedInAt, lastActiveAt, current }] */
export const fetchSessionsApi = () => api("/account/sessions");
export const revokeSessionApi = (id) => api(`/account/sessions/${id}`, { method: "DELETE" });
/** -> { revoked } */
export const revokeOtherSessionsApi = () => api("/account/sessions", { method: "DELETE" });
