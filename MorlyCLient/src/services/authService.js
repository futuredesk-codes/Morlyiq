import { api } from "./http.js";

// Session storage lives in session.js; re-exported so existing imports keep working
export { loadSession, saveSession, clearSession } from "./session.js";

/** POST /auth/login -> { token, user, clinics, tenant }, or { mfaRequired, mfaToken, emailHint } when MFA is on */
export const loginApi = (email, password) => api("/auth/login", { method: "POST", body: { email, password }, auth: false });

/** POST /auth/mfa/verify — step 2 of login when MFA is on -> { token, user, clinics, tenant } */
export const mfaVerifyApi = (mfaToken, code) => api("/auth/mfa/verify", { method: "POST", body: { mfaToken, code }, auth: false });

/** POST /auth/mfa/resend — emails a new login code (the server allows one per 30s) -> { emailHint } */
export const mfaResendApi = (mfaToken) => api("/auth/mfa/resend", { method: "POST", body: { mfaToken }, auth: false });

/** POST /auth/forgot-password — emails a 6-digit reset code. The answer is the same whether or not the email has
 *  an account (so it can't be used to find out who is registered) -> { email (masked) } */
export const forgotPasswordApi = (email) => api("/auth/forgot-password", { method: "POST", body: { email }, auth: false });

/** POST /auth/reset-password — sets a new password using the emailed code (also signs out all devices) */
export const resetPasswordApi = ({ email, code, newPassword }) =>
  api("/auth/reset-password", { method: "POST", body: { email, code, newPassword }, auth: false });

/** GET /auth/me — checks the stored token is still a live session -> { user, clinics, tenant } */
export const fetchMeApi = (token) => api("/auth/me", { token });

/** POST /auth/logout — ends this device's session on the server (best effort: local sign-out happens anyway) */
export const logoutApi = () => api("/auth/logout", { method: "POST", redirectOnExpiry: false }).catch(() => {});
