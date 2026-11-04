import { AdminUser } from "../../../models/admin/AdminUser.js";
import {
  signAdminMfaToken,
  signAdminToken,
  verifyAdminMfaToken,
} from "../../../middlewares/admin/adminAuth.js";
import { attempts } from "../../../services/client/attemptGuard.js";
import { isEmailConfigured } from "../../../services/client/emailService.js";
import {
  ADMIN_RESET_SELECT,
  consumeAdminResetCode,
  issueAdminResetCode,
} from "../../../services/admin/passwordResetService.js";
import { getRoleForAdmin, permissionList } from "../../../services/admin/roleService.js";
import {
  ADMIN_MFA_SELECT,
  consumeAdminMfaCode,
  issueAdminMfaCode,
  maskAdminEmail,
} from "../../../services/admin/mfaCodeService.js";
import { superAdminMfaRequired } from "../../../services/admin/platformSettingsService.js";
import { createAdminSession, revokeAdminSession } from "../../../services/admin/sessionService.js";
import { ADMIN_INVITATION_SELECT } from "../../../services/admin/invitationService.js";
import { recordAdminAuditSafely } from "../../../services/admin/auditService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const clientIp = (req) => String(req.ip || req.socket?.remoteAddress || "unknown");
const maskEmail = (email) => email.replace(/^(.).*(@.*)$/, "$1***$2");

const auditAuthEvent = (req, entry) => recordAdminAuditSafely({
  ...entry,
  req,
  source: "admin_auth",
});

const publicUser = (user, role) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: role?.roleName || user.role,
  roleId: role ? String(role._id) : null,
  org: user.organization,
  initials: user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join(""),
  permissions: permissionList(role),
});

async function completeLogin(user, role, req, res, authenticationMethod = "password") {
  user.lastActive = "just now";
  user.lastActiveAt = new Date();
  if (user.status === "invited") user.status = "active";
  await user.save();
  const session = await createAdminSession(user, req);
  await auditAuthEvent(req, {
    user,
    roleName: role.roleName,
    action: "Admin signed in",
    target: authenticationMethod === "mfa" ? "Authentication completed with MFA" : "Authentication completed with password",
    level: "info",
  });
  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: { user: publicUser(user, role), token: signAdminToken(user, session.id) },
  });
}

async function sendAdminLoginCode(user, res) {
  const result = await issueAdminMfaCode(user);
  if (!result.sent) {
    return res.status(result.wait ? 429 : 503).json({
      success: false,
      code: result.wait ? "RESEND_TOO_SOON" : "EMAIL_UNAVAILABLE",
      message: result.reason,
    });
  }
  const emailHint = maskAdminEmail(user.email);
  return res.status(200).json({
    success: true,
    message: `Verification code sent to ${emailHint}`,
    data: { mfaRequired: true, mfaToken: signAdminMfaToken(user), emailHint },
  });
}

export const login = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  if (!email || !password) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Email and password are required" });
  }

  const user = await AdminUser.findOne({ email }).select(`+password ${ADMIN_MFA_SELECT} ${ADMIN_INVITATION_SELECT}`);
  const passwordMatches = user ? await user.matchesPassword(password) : false;
  if (!user || !passwordMatches) {
    await auditAuthEvent(req, {
      user,
      actorEmail: email,
      actorName: user?.name || email,
      roleName: user?.role || "Unknown",
      action: "Admin sign-in failed",
      target: "Invalid credentials",
      level: "warn",
    });
    return res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  }
  if (!["active", "invited"].includes(user.status)) {
    return res.status(403).json({ success: false, code: "ACCOUNT_INACTIVE", message: "This account is not active" });
  }
  if (user.status === "invited" && user.invitation?.tokenHash) {
    return res.status(403).json({
      success: false,
      code: "INVITATION_PENDING",
      message: "Accept the invitation from your email and create a password before signing in",
    });
  }
  const role = await getRoleForAdmin(user);
  if (!role) {
    return res.status(403).json({ success: false, code: "ROLE_UNAVAILABLE", message: "Your assigned role is not available" });
  }
  if (role.roleName === "Super Admin" && await superAdminMfaRequired()) {
    if (!isEmailConfigured()) {
      return res.status(503).json({ success: false, code: "EMAIL_UNAVAILABLE", message: "MFA is required but verification email is currently unavailable" });
    }
    return sendAdminLoginCode(user, res);
  }
  return completeLogin(user, role, req, res, "password");
};

export const resendMfaLogin = async (req, res) => {
  let userId;
  try {
    userId = verifyAdminMfaToken(String(req.body?.mfaToken || ""));
  } catch {
    return res.status(401).json({ success: false, code: "MFA_SESSION_EXPIRED", message: "Your sign-in timed out. Enter your password again." });
  }
  const user = await AdminUser.findById(userId).select(ADMIN_MFA_SELECT);
  if (!user || !["active", "invited"].includes(user.status)) {
    return res.status(401).json({ success: false, code: "MFA_SESSION_EXPIRED", message: "Please sign in again" });
  }
  return sendAdminLoginCode(user, res);
};

export const verifyMfaLogin = async (req, res) => {
  let userId;
  try {
    userId = verifyAdminMfaToken(String(req.body?.mfaToken || ""));
  } catch {
    return res.status(401).json({ success: false, code: "MFA_SESSION_EXPIRED", message: "Your sign-in timed out. Enter your password again." });
  }

  const code = String(req.body?.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Enter the 6-digit verification code" });
  }

  const user = await AdminUser.findById(userId).select(ADMIN_MFA_SELECT);
  if (!user || !["active", "invited"].includes(user.status)) {
    return res.status(401).json({ success: false, code: "MFA_SESSION_EXPIRED", message: "Please sign in again" });
  }

  const attemptKey = `admin-mfa:${userId}`;
  const wait = attempts.blockedFor(attemptKey);
  if (wait) {
    return res.status(429).json({ success: false, code: "TOO_MANY_ATTEMPTS", message: `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minute(s).` });
  }
  if (!consumeAdminMfaCode(user, code)) {
    attempts.fail(attemptKey);
    return res.status(401).json({ success: false, code: "INVALID_MFA_CODE", message: "That code is incorrect or has expired" });
  }
  attempts.clear(attemptKey);

  const role = await getRoleForAdmin(user);
  if (!role || role.roleName !== "Super Admin") {
    return res.status(403).json({ success: false, code: "ROLE_UNAVAILABLE", message: "Super Admin access is no longer available" });
  }
  return completeLogin(user, role, req, res, "mfa");
};

export const logout = async (req, res) => {
  await revokeAdminSession(req.adminSessionId, req.adminUser.id);
  await auditAuthEvent(req, {
    user: req.adminUser,
    roleName: req.adminRole.roleName,
    action: "Admin signed out",
    target: "Session ended by user",
    level: "info",
  });
  return res.status(200).json({ success: true, message: "Signed out successfully", data: null });
};

export const forgotPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!EMAIL_RE.test(email)) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid email address" });
  }

  const ipKey = `admin-forgot-ip:${clientIp(req)}`;
  const wait = attempts.blockedFor(ipKey);
  if (wait) {
    return res.status(429).json({ success: false, code: "TOO_MANY_ATTEMPTS", message: `Too many requests. Try again in ${Math.ceil(wait / 60)} minute(s).` });
  }
  attempts.fail(ipKey);

  const user = await AdminUser.findOne({ email }).select(`${ADMIN_RESET_SELECT} ${ADMIN_INVITATION_SELECT}`);
  if (!user) {
    return res.status(404).json({ success: false, code: "ADMIN_NOT_FOUND", message: "No Admin account was found for this email" });
  }
  if (!["active", "invited"].includes(user.status)) {
    return res.status(403).json({ success: false, code: "ACCOUNT_INACTIVE", message: "This Admin account is not active" });
  }
  if (user.status === "invited" && user.invitation?.tokenHash) {
    return res.status(409).json({
      success: false,
      code: "INVITATION_PENDING",
      message: "Use the invitation email to create your password first",
    });
  }
  if (!isEmailConfigured() || !(process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET)) {
    return res.status(503).json({ success: false, code: "EMAIL_UNAVAILABLE", message: "Password reset by email is not available right now" });
  }

  try {
    const result = await issueAdminResetCode(user);
    if (result.throttled) {
      return res.status(429).json({ success: false, code: "RESET_CODE_THROTTLED", message: "A reset code was sent recently. Please wait 30 seconds before requesting another." });
    }
    if (!result.sent) {
      return res.status(502).json({ success: false, code: "EMAIL_SEND_FAILED", message: result.reason || "The reset email could not be sent" });
    }
  } catch (error) {
    console.error(`[Admin Auth] forgot-password failed: ${error.message}`);
    return res.status(502).json({ success: false, code: "EMAIL_SEND_FAILED", message: "The reset email could not be sent" });
  }

  return res.status(200).json({
    success: true,
    message: "A 6-digit password reset code has been sent to the Admin email.",
    data: { email: maskEmail(user.email) },
  });
};

export const resetPassword = async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || "").replace(/\s/g, "");
  const newPassword = String(req.body?.newPassword || "");
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code) || newPassword.length < 8) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Enter a valid email, 6-digit code, and a password of at least 8 characters",
    });
  }

  const attemptKey = `admin-reset:${email}`;
  const wait = attempts.blockedFor(attemptKey);
  if (wait) {
    return res.status(429).json({ success: false, code: "TOO_MANY_ATTEMPTS", message: `Too many wrong codes. Try again in ${Math.ceil(wait / 60)} minute(s).` });
  }

  const user = await AdminUser.findOne({ email }).select(`+password ${ADMIN_RESET_SELECT} ${ADMIN_INVITATION_SELECT}`);
  if (user?.status === "invited" && user.invitation?.tokenHash) {
    return res.status(409).json({
      success: false,
      code: "INVITATION_PENDING",
      message: "Use the invitation email to create your password first",
    });
  }
  if (!user || !["active", "invited"].includes(user.status) || !consumeAdminResetCode(user, code)) {
    attempts.fail(attemptKey);
    return res.status(400).json({ success: false, code: "INVALID_RESET_CODE", message: "That code is not correct or has expired" });
  }
  if (await user.matchesPassword(newPassword)) {
    await user.save();
    return res.status(422).json({ success: false, code: "PASSWORD_REUSED", message: "Choose a different password, request a new code, and try again" });
  }

  attempts.clear(attemptKey);
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  if (user.status === "invited") user.status = "active";
  await user.save();

  return res.status(200).json({ success: true, message: "Password reset. Please sign in with your new password.", data: null });
};

export const getProfile = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Profile loaded",
    data: { user: publicUser(req.adminUser, req.adminRole) },
  });
};
