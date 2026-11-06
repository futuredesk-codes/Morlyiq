import { AdminUser } from "../../../models/admin/AdminUser.js";
import { getPlatformSettings, publicPlatformSettings } from "../../../services/admin/platformSettingsService.js";
import { PlatformSettings } from "../../../models/admin/PlatformSettings.js";
import { recordAdminAuditSafely } from "../../../services/admin/auditService.js";
import { attempts } from "../../../services/client/attemptGuard.js";
import { isEmailConfigured } from "../../../services/client/emailService.js";

const responseData = (settings) => ({
  ...publicPlatformSettings(settings),
  security: {
    requireMfaForSuperAdmins: Boolean(settings.security?.requireMfaForSuperAdmins),
  },
  updatedAt: settings.updatedAt,
});

export const updateSettings = async (req, res) => {
  const body = req.body || {};
  const allowed = ["supportEmail", "trialLengthDays", "verificationProvider", "maintenanceMode", "allowSignups"];
  if (!Object.keys(body).length || Object.keys(body).some((key) => !allowed.includes(key))) {
    return res.status(422).json({ success: false, message: "Provide supported platform settings only" });
  }
  const changes = {};
  if (body.supportEmail !== undefined) {
    if (typeof body.supportEmail !== "string" || body.supportEmail.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.supportEmail.trim())) {
      return res.status(422).json({ success: false, message: "Enter a valid support email" });
    }
    changes.supportEmail = body.supportEmail.trim().toLowerCase();
  }
  if (body.trialLengthDays !== undefined) {
    if (!Number.isInteger(body.trialLengthDays) || body.trialLengthDays < 1 || body.trialLengthDays > 365) {
      return res.status(422).json({ success: false, message: "Trial length must be a whole number between 1 and 365 days" });
    }
    changes.trialLengthDays = body.trialLengthDays;
  }
  for (const key of ["maintenanceMode", "allowSignups"]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") return res.status(422).json({ success: false, message: `${key} must be true or false` });
    changes[key] = body[key];
  }
  if (body.verificationProvider !== undefined && body.verificationProvider !== "stedi") {
    return res.status(422).json({ success: false, message: "Stedi is the currently supported verification provider" });
  }
  await getPlatformSettings();
  const settings = await PlatformSettings.findOneAndUpdate({ key: "global" }, { $set: { ...changes, verificationProvider: "stedi", updatedBy: req.adminUser._id } }, { returnDocument: "after", runValidators: true });
  await recordAdminAuditSafely({ user: req.adminUser, roleName: req.adminRole.roleName, action: "Platform settings updated", target: Object.keys(changes).join(", "), req });
  return res.json({ success: true, message: "Platform settings saved", data: responseData(settings) });
};

export const getSettings = async (_req, res) => {
  const settings = await getPlatformSettings();
  return res.status(200).json({ success: true, message: "Platform settings loaded", data: responseData(settings) });
};

export const setSuperAdminMfaPolicy = async (req, res) => {
  if (typeof req.body?.enabled !== "boolean") {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "MFA setting must be true or false" });
  }
  const password = String(req.body?.password || "");
  if (!password) {
    return res.status(422).json({ success: false, code: "PASSWORD_REQUIRED", message: "Enter your current password to change this security setting" });
  }

  const attemptKey = `admin-settings-mfa:${req.adminUser.id}`;
  const wait = attempts.blockedFor(attemptKey);
  if (wait) {
    return res.status(429).json({ success: false, code: "TOO_MANY_ATTEMPTS", message: `Too many incorrect password attempts. Try again in ${Math.ceil(wait / 60)} minute(s).` });
  }

  const user = await AdminUser.findById(req.adminUser.id).select("+password");
  if (!user || !(await user.matchesPassword(password))) {
    attempts.fail(attemptKey);
    return res.status(401).json({ success: false, code: "INVALID_PASSWORD", message: "Current password is incorrect" });
  }
  attempts.clear(attemptKey);

  if (req.body.enabled && !isEmailConfigured()) {
    return res.status(503).json({ success: false, code: "EMAIL_UNAVAILABLE", message: "Configure SMTP email before requiring MFA, otherwise Super Admins could be locked out" });
  }

  const settings = await getPlatformSettings();
  settings.security.requireMfaForSuperAdmins = req.body.enabled;
  settings.updatedBy = user._id;
  await settings.save();

  return res.status(200).json({
    success: true,
    message: req.body.enabled
      ? "MFA is now required for all Super Admins"
      : "MFA is no longer required for Super Admins",
    data: responseData(settings),
  });
};
