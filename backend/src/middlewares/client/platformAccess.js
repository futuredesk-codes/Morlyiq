import { getPlatformSettings, publicPlatformSettings } from "../../services/admin/platformSettingsService.js";

export const getPublicPlatformSettings = async (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({ success: true, data: publicPlatformSettings(await getPlatformSettings()) });
};

export const requireClientPlatformAvailable = async (req, res, next) => {
  // Payment webhooks are mounted separately in server.js. Logout stays available.
  if (req.path === "/auth/logout") return next();
  const settings = publicPlatformSettings(await getPlatformSettings());
  if (!settings.maintenanceMode) return next();
  res.set("Retry-After", "60");
  return res.status(503).json({ success: false, code: "PLATFORM_MAINTENANCE", message: "MorlyIQ is undergoing scheduled maintenance. Please try again shortly.", data: settings });
};
