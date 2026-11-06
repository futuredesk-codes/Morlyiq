import bcrypt from "bcryptjs";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { ClientSession } from "../../../models/client/ClientSession.js";
import { Client as Tenant } from "../../../models/Client.js";
import { accessibleClinics } from "../../../middlewares/client/clinic/clinicAccess.js";
import { signClientToken, signMfaToken, verifyMfaToken } from "../../../middlewares/client/auth/clientAuth.js";
import { ok, fail, invalid } from "../../../utils/client/apiResponse.js";
import { createSession, revokeSessions } from "../../../services/client/sessionService.js";
import { RESET_SELECT, consumeResetCode, issueResetCode } from "../../../services/client/passwordResetService.js";
import { isEmailConfigured } from "../../../services/client/emailService.js";
import { MFA_SELECT, consumeEmailCode, issueEmailCode, maskEmail } from "../../../services/client/mfaCodeService.js";
import { logActivity } from "../../../services/client/activityService.js";
import { attempts } from "../../../services/client/attemptGuard.js";
import { ensureTrialWindow, trialExpired } from "../../../services/client/trialService.js";

const initialsOf = (name) =>
  name.replace(/^Dr\.\s*/i, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

// Owner is account-level ("*"): can sign in and add the first clinic even when the practice has none yet
const isOwner = (user) => user.memberships.some((m) => m.active && m.clinicId === "*" && m.role === "Owner");

export const publicUser = (user) => ({
  id: user.id,
  isOwner: isOwner(user),
  name: user.name,
  email: user.email,
  initials: initialsOf(user.name),
  mfaEnabled: Boolean(user.mfa?.enabled),
});

// Tenant info comes from the Admin-managed Client record (status, clinic quota, plan entitlements)
const publicTenant = (client) => ({
  id: client.id,
  name: client.name,
  status: client.status,
  trialEndsAt: client.trialEndsAt || null,
  trialExpired: Boolean(trialExpired(client)),
  clinics: client.clinics,
  entitlements: Object.fromEntries(client.entitlements || []),
});


/** Final step of a login (after password, and after MFA when it is enabled): creates the device session. */
async function completeLogin(user, req, res) {
  const tenant = await Tenant.findById(user.tenantId);
  if (!tenant || ["suspended", "archived"].includes(tenant.status)) {
    return fail(res, 403, "This practice account is suspended. Contact support.", { code: "PRACTICE_SUSPENDED" });
  }
  if (tenant.status === "invited") {
    return fail(res, 403, "Finish payment and password setup from your invitation email before signing in.", { code: "ONBOARDING_INCOMPLETE" });
  }
  await ensureTrialWindow(tenant);
  // Which clinics this person can open, and their role at each
  const clinics = await accessibleClinics(user);
  if (!clinics.length && !isOwner(user)) {
    return fail(res, 403, "You have not been assigned to any clinic. Contact your practice Owner.", { code: "NO_CLINIC_ASSIGNED" });
  }

  user.lastLoginAt = new Date();
  user.status = "active"; // "invited" users become active on first login
  await user.save();
  const session = await createSession(user, req);
  logActivity(user, "Signed in");
  ok(res, "Login successful", {
    token: signClientToken(user, session.id),
    user: publicUser(user),
    clinics,
    tenant: publicTenant(tenant),
  });
}

// Emails the login code and tells the page where to look. Used by login and by "Resend code".
async function sendLoginCode(user, res) {
  const r = await issueEmailCode(user);
  if (!r.sent) return fail(res, r.wait ? 429 : 503, r.reason, { code: r.wait ? "RESEND_TOO_SOON" : "EMAIL_UNAVAILABLE" });
  return ok(res, `Verification code sent to ${maskEmail(user.email)}`, { mfaRequired: true, mfaToken: signMfaToken(user), emailHint: maskEmail(user.email) });
}

// POST /api/client-panel/auth/login  (step 1: password)
export const login = async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const errors = [];
  if (!email) errors.push({ field: "email", message: "Email is required" });
  if (!password) errors.push({ field: "password", message: "Password is required" });
  if (errors.length) return invalid(res, errors);

  const user = await ClientUser.findOne({ email }).select(`+password ${MFA_SELECT}`);
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return fail(res, 401, "Invalid email or password", { code: "INVALID_CREDENTIALS" });
  }
  // "invited" users sign in with their temporary password and become active on first login
  if (!["active", "invited"].includes(user.status)) return fail(res, 403, "This account is not active", { code: "ACCOUNT_INACTIVE" });

  // Practice requires MFA: staff who have not set it up yet are switched on here, so this sign-in already needs the code
  if (!user.mfa?.enabled && (await Tenant.exists({ _id: user.tenantId, "securityPolicy.requireMfa": true }))) {
    if (!isEmailConfigured()) return fail(res, 503, "Your practice requires MFA but email is unavailable right now. Please try again later.", { code: "EMAIL_UNAVAILABLE" });
    user.mfa.enabled = true;
  }

  // MFA on: no session yet — a 6-digit code is emailed and must be sent to /auth/mfa/verify
  if (user.mfa?.enabled) return sendLoginCode(user, res);
  return completeLogin(user, req, res);
};

// POST /api/client-panel/auth/mfa/resend  { mfaToken } — sends a fresh code (max once per 30s)
export const resendMfaLogin = async (req, res) => {
  let userId;
  try {
    userId = verifyMfaToken(String(req.body.mfaToken || ""));
  } catch {
    return fail(res, 401, "Your sign-in timed out. Please enter your password again.", { code: "MFA_SESSION_EXPIRED" });
  }
  const user = await ClientUser.findById(userId).select(MFA_SELECT);
  if (!user || !user.mfa?.enabled) return fail(res, 401, "Please sign in again.", { code: "MFA_SESSION_EXPIRED" });
  return sendLoginCode(user, res);
};

// POST /api/client-panel/auth/mfa/verify  (step 2: the emailed code)
export const verifyMfaLogin = async (req, res) => {
  let userId;
  try {
    userId = verifyMfaToken(String(req.body.mfaToken || ""));
  } catch {
    return fail(res, 401, "Your sign-in timed out. Please enter your password again.", { code: "MFA_SESSION_EXPIRED" });
  }
  const user = await ClientUser.findById(userId).select(MFA_SELECT);
  if (!user || !user.mfa?.enabled) return fail(res, 401, "Please sign in again.", { code: "MFA_SESSION_EXPIRED" });

  const wait = attempts.blockedFor(userId);
  if (wait) return fail(res, 429, `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minute(s).`, { code: "TOO_MANY_ATTEMPTS" });

  if (!consumeEmailCode(user, req.body.code)) {
    attempts.fail(userId);
    return fail(res, 401, "That code is not correct or has expired", { code: "INVALID_MFA_CODE" });
  }
  attempts.clear(userId);
  return completeLogin(user, req, res); // saves the user, which also stores the consumed code
};

// ---------------------------------------------------------------- Forgot password
const normEmail = (v) => String(v || "").trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clientIp = (req) => String(req.ip || req.socket?.remoteAddress || "unknown");

// POST /api/client-panel/auth/forgot-password  { email }
// Always answers the same 200, whether or not the email has an account, so it cannot be used to find
// out who uses MorlyIQ. The email is sent after replying, so the response time does not give it away either.
export const forgotPassword = async (req, res) => {
  const email = normEmail(req.body.email);
  if (!EMAIL_RE.test(email)) return invalid(res, [{ field: "email", message: "Enter a valid email address" }]);
  if (!isEmailConfigured()) {
    return fail(res, 503, "Password reset by email is not available right now. Please contact your practice Owner.", { code: "EMAIL_UNAVAILABLE" });
  }

  // Each call counts against the caller's IP (5 per 10 minutes), so the form cannot be used to flood inboxes
  const ipKey = `forgot-ip:${clientIp(req)}`;
  const wait = attempts.blockedFor(ipKey);
  if (wait) return fail(res, 429, `Too many requests. Try again in ${Math.ceil(wait / 60)} minute(s).`, { code: "TOO_MANY_ATTEMPTS" });
  attempts.fail(ipKey);

  ok(res, "If an account exists for that email, we have sent a 6-digit code to it.", { email: maskEmail(email) });

  // After replying: only active people get a code (deactivated accounts are ignored silently)
  try {
    const user = await ClientUser.findOne({ email }).select(RESET_SELECT);
    if (user && ["active", "invited"].includes(user.status)) await issueResetCode(user);
  } catch (err) {
    console.error(`[Auth] forgot-password failed: ${err.message}`);
  }
};

// POST /api/client-panel/auth/reset-password  { email, code, newPassword }
export const resetPassword = async (req, res) => {
  const email = normEmail(req.body.email);
  const code = String(req.body.code || "").replace(/\s/g, "");
  const newPassword = String(req.body.newPassword || "");
  const errors = [];
  if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Enter a valid email address" });
  if (!/^\d{6}$/.test(code)) errors.push({ field: "code", message: "Enter the 6-digit code from your email" });
  if (newPassword.length < 8) errors.push({ field: "newPassword", message: "New password must be at least 8 characters" });
  if (errors.length) return invalid(res, errors);

  // Wrong codes are counted per email (even for emails with no account), so 6 digits cannot be guessed
  const key = `reset:${email}`;
  const wait = attempts.blockedFor(key);
  if (wait) return fail(res, 429, `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minute(s).`, { code: "TOO_MANY_ATTEMPTS" });

  const user = await ClientUser.findOne({ email }).select(`+password ${RESET_SELECT}`);
  // Same answer for "no such account", "deactivated" and "wrong/expired code"
  if (!user || !["active", "invited"].includes(user.status) || !consumeResetCode(user, code)) {
    attempts.fail(key);
    return fail(res, 400, "That code is not correct or has expired", { code: "INVALID_RESET_CODE" });
  }
  if (await bcrypt.compare(newPassword, user.password)) {
    // The code was valid but is now used up — ask for a different password and a new code
    await user.save();
    return invalid(res, [{ field: "newPassword", message: "Choose a password you have not used on this account. Request a new code and try again." }]);
  }

  attempts.clear(key);
  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordChangedAt = new Date();
  await user.save();
  // Whoever had the old password must not stay signed in
  await revokeSessions(user.id);
  ok(res, "Password reset. Please sign in with your new password.");
};

// POST /api/client-panel/auth/logout — signs out THIS device only
export const logout = async (req, res) => {
  await ClientSession.updateOne({ _id: req.sessionId }, { revokedAt: new Date() });
  ok(res, "Signed out successfully");
};

// GET /api/client-panel/auth/me
export const me = async (req, res) => {
  ok(res, "Session is valid", {
    user: publicUser(req.user),
    clinics: await accessibleClinics(req.user),
    tenant: publicTenant(req.user.tenantId),
  });
};
