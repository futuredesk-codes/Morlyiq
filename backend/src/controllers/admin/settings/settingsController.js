import { AdminUser } from "../../../models/admin/AdminUser.js";
import { getPlatformSettings } from "../../../services/admin/platformSettingsService.js";
import { attempts } from "../../../services/client/attemptGuard.js";
import { isEmailConfigured } from "../../../services/client/emailService.js";

const responseData = (settings) => ({
  security: {
    requireMfaForSuperAdmins: Boolean(settings.security?.requireMfaForSuperAdmins),
  },
  updatedAt: settings.updatedAt,
});

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
