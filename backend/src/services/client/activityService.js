import { ActivityLog } from "../../models/client/ActivityLog.js";

/**
 * Records one entry in the practice's activity log. `user` is the signed-in ClientUser (tenantId may be
 * populated or an id). Never throws: failing to write the log must not break the action being logged.
 */
export async function logActivity(user, action, target = "") {
  try {
    await ActivityLog.create({
      tenantId: user.tenantId?._id ?? user.tenantId,
      actorId: user._id,
      actorName: user.name,
      action,
      target,
    });
  } catch (err) {
    console.error(`[Activity] could not log "${action}": ${err.message}`);
  }
}
