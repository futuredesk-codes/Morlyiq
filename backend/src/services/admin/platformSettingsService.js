import { PlatformSettings } from "../../models/admin/PlatformSettings.js";

export const getPlatformSettings = async () => {
  const existing = await PlatformSettings.findOne({ key: "global" });
  if (existing) return existing;
  try {
    return await PlatformSettings.findOneAndUpdate(
      { key: "global" }, { $setOnInsert: { key: "global" } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code === 11000) return PlatformSettings.findOne({ key: "global" });
    throw error;
  }
};

export const publicPlatformSettings = (settings) => ({
  supportEmail: settings.supportEmail || "support@dentalverify.ai",
  trialLengthDays: settings.trialLengthDays ?? 14,
  verificationProvider: "stedi",
  maintenanceMode: settings.maintenanceMode === true,
  allowSignups: settings.allowSignups !== false,
});

export async function superAdminMfaRequired() {
  const settings = await getPlatformSettings();
  return Boolean(settings.security?.requireMfaForSuperAdmins);
}
