import { PlatformSettings } from "../../models/admin/PlatformSettings.js";

export const getPlatformSettings = () => PlatformSettings.findOneAndUpdate(
  { key: "global" },
  { $setOnInsert: { key: "global" } },
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

export async function superAdminMfaRequired() {
  const settings = await getPlatformSettings();
  return Boolean(settings.security?.requireMfaForSuperAdmins);
}
