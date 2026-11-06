import { Client } from "../../models/Client.js";
import { getPlatformSettings } from "../admin/platformSettingsService.js";

export async function ensureTrialWindow(client) {
  if (client.status !== "trial" || client.trialEndsAt) return client;
  const settings = await getPlatformSettings();
  // Preserve dated trials. Legacy records receive the configured duration on
  // first access without retroactively expiring an account during rollout.
  const start = new Date();
  const updated = await Client.findOneAndUpdate(
    { _id: client._id, status: "trial", trialEndsAt: null },
    { $set: { trialStartedAt: start, trialEndsAt: new Date(start.getTime() + (settings.trialLengthDays ?? 14) * 86400000) } },
    { returnDocument: "after" },
  );
  const current = updated || await Client.findById(client._id);
  if (current) { client.trialStartedAt = current.trialStartedAt; client.trialEndsAt = current.trialEndsAt; }
  return client;
}

export const trialExpired = (client) => client.status === "trial" && client.trialEndsAt && new Date(client.trialEndsAt) <= new Date();
