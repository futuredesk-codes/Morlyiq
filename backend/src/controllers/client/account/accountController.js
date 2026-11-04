import bcrypt from "bcryptjs";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { ClientSession } from "../../../models/client/ClientSession.js";
import { revokeSessions } from "../../../services/client/sessionService.js";
import { logActivity } from "../../../services/client/activityService.js";
import { ok, fail, invalid } from "../../../utils/client/apiResponse.js";
import { attempts } from "../../../services/client/attemptGuard.js";
import { MFA_SELECT, maskEmail } from "../../../services/client/mfaCodeService.js";
import { Client as Tenant } from "../../../models/Client.js";
import { isEmailConfigured } from "../../../services/client/emailService.js";

// "Your account" — every signed-in staff member (Owner, Manager, Front Desk, Billing, Dentist)
// manages ONLY their own password, MFA and sessions. Nothing here takes a user id.


const loadMe = (req) => ClientUser.findById(req.user.id).select(`+password ${MFA_SELECT}`);

/** Responds 429 and returns true if the user is locked out after too many wrong attempts. */
const locked = (res, userId) => {
  const wait = attempts.blockedFor(userId);
  if (wait) fail(res, 429, `Too many wrong attempts. Try again in ${Math.ceil(wait / 60)} minute(s).`, { code: "TOO_MANY_ATTEMPTS" });
  return Boolean(wait);
};

// ---------------------------------------------------------------- Password
// POST /api/client-panel/account/password  { currentPassword, newPassword }
export const changePassword = async (req, res) => {
  const { currentPassword = "", newPassword = "" } = req.body;
  if (!currentPassword) return invalid(res, [{ field: "currentPassword", message: "Current password is required" }]);
  if (newPassword.length < 8) return invalid(res, [{ field: "newPassword", message: "New password must be at least 8 characters" }]);
  if (newPassword === currentPassword) return invalid(res, [{ field: "newPassword", message: "New password must be different from the current one" }]);

  const user = await loadMe(req);
  if (locked(res, user.id)) return;
  if (!(await bcrypt.compare(currentPassword, user.password))) {
    attempts.fail(user.id);
    return invalid(res, [{ field: "currentPassword", message: "Current password is incorrect" }]);
  }
  attempts.clear(user.id);

  user.password = await bcrypt.hash(newPassword, 10);
  user.passwordChangedAt = new Date();
  await user.save();
  // A password change signs every OTHER device out (this one stays signed in)
  const { modifiedCount } = await revokeSessions(user.id, req.sessionId);
  logActivity(req.user, "Changed password", "Own account");
  ok(res, modifiedCount ? `Password updated. ${modifiedCount} other device(s) signed out` : "Password updated", { signedOutOtherDevices: modifiedCount });
};

// ---------------------------------------------------------------- MFA (code sent by email at login)
// GET /api/client-panel/account/mfa � `policyRequired`: the practice Owner requires MFA, so it cannot be turned off
export const mfaStatus = async (req, res) => {
  ok(res, "MFA status loaded", {
    enabled: Boolean(req.user.mfa?.enabled),
    email: maskEmail(req.user.email),
    policyRequired: Boolean(req.user.tenantId?.securityPolicy?.requireMfa),
  });
};

// PUT /api/client-panel/account/mfa  { enabled: true | false, password } — on/off switch for the signed-in user.
// The password is required both ways, so nobody can change it from a browser that was left open.
// While it is on, every sign-in also needs a 6-digit code emailed to the user (see auth/login).
export const mfaSet = async (req, res) => {
  const enabled = req.body.enabled === true;
  const user = await loadMe(req);
  if (locked(res, user.id)) return;
  if (!(await bcrypt.compare(String(req.body.password || ""), user.password))) {
    attempts.fail(user.id);
    return invalid(res, [{ field: "password", message: "Password is incorrect" }]);
  }
  attempts.clear(user.id);

  if (!enabled && req.user.tenantId?.securityPolicy?.requireMfa) {
    return fail(res, 403, "Your practice requires MFA for all staff, so it cannot be turned off", { code: "MFA_REQUIRED_BY_POLICY" });
  }
  if (enabled && !isEmailConfigured()) {
    // The login code is sent by email, so turning MFA on without email would lock the user out
    return fail(res, 503, "Email is not set up on the server, so MFA cannot be turned on yet", { code: "EMAIL_UNAVAILABLE" });
  }
  user.mfa.enabled = enabled;
  await user.save();
  logActivity(req.user, enabled ? "Turned on MFA" : "Turned off MFA", "Own account");
  ok(res, enabled ? "MFA enabled" : "MFA disabled", { enabled });
};

// ---------------------------------------------------------------- Practice policy (Owner only)
const isOwner = (user) => user.memberships.some((m) => m.active && m.clinicId === "*" && m.role === "Owner");

// GET /api/client-panel/account/policy
export const getPolicy = async (req, res) => {
  if (!isOwner(req.user)) return fail(res, 403, "Only the practice Owner can manage the practice policy", { code: "ROLE_NOT_ALLOWED" });
  ok(res, "Practice policy loaded", { requireMfa: Boolean(req.user.tenantId.securityPolicy?.requireMfa) });
};

// PUT /api/client-panel/account/policy  { requireMfa: true | false }
// While on, every staff member's next sign-in needs the emailed code (their MFA is switched on automatically
// once they verify it, see auth/login) and they cannot turn MFA off.
export const setPolicy = async (req, res) => {
  if (!isOwner(req.user)) return fail(res, 403, "Only the practice Owner can manage the practice policy", { code: "ROLE_NOT_ALLOWED" });
  const requireMfa = req.body.requireMfa === true;
  if (requireMfa && !isEmailConfigured()) {
    // The login code is sent by email, so requiring MFA without email would lock the whole practice out
    return fail(res, 503, "Email is not set up on the server, so MFA cannot be required yet", { code: "EMAIL_UNAVAILABLE" });
  }
  await Tenant.updateOne({ _id: req.user.tenantId._id }, { "securityPolicy.requireMfa": requireMfa });
  logActivity(req.user, requireMfa ? "Required MFA for all staff" : "Stopped requiring MFA for all staff", "Practice policy");
  ok(res, requireMfa ? "MFA is now required for all staff" : "MFA is no longer required", { requireMfa });
};

// ---------------------------------------------------------------- Active sessions
const toSession = (s, currentId) => ({
  id: s.id,
  device: s.device,
  ip: s.ip,
  signedInAt: s.createdAt,
  lastActiveAt: s.lastActiveAt,
  current: s.id === currentId,
});

// GET /api/client-panel/account/sessions — this user's signed-in devices, newest activity first
export const listSessions = async (req, res) => {
  const sessions = await ClientSession.find({
    userId: req.user.id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ lastActiveAt: -1 });
  ok(res, "Active sessions loaded", sessions.map((s) => toSession(s, req.sessionId)));
};

// DELETE /api/client-panel/account/sessions/:id — sign out one other device
export const revokeSession = async (req, res) => {
  if (req.params.id === req.sessionId) return fail(res, 400, "Use Sign out to end this device's session", { code: "CURRENT_SESSION" });
  const r = await ClientSession.updateOne(
    { _id: req.params.id, userId: req.user.id, revokedAt: null },
    { revokedAt: new Date() }
  ).catch(() => ({ matchedCount: 0 }));
  if (!r.matchedCount) return fail(res, 404, "Session not found");
  ok(res, "Device signed out");
};

// DELETE /api/client-panel/account/sessions — sign out every other device
export const revokeOtherSessions = async (req, res) => {
  const { modifiedCount } = await revokeSessions(req.user.id, req.sessionId);
  ok(res, modifiedCount ? `Signed out ${modifiedCount} other device(s)` : "No other devices were signed in", { revoked: modifiedCount });
};
