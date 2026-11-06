import crypto from "node:crypto";
import mongoose from "mongoose";
import { Lead } from "../../models/admin/Lead.js";
import { AdminUser } from "../../models/admin/AdminUser.js";
import { AdminNotification } from "../../models/admin/AdminNotification.js";
import { Client } from "../../models/Client.js";
import { getRoleForAdmin, roleHasPermission } from "./roleService.js";
import { createAdminNotification } from "./notificationService.js";
import { sendAdminLeadReminder } from "./emailService.js";

const MINUTE = 60_000;
// A database lease prevents concurrent server processes from delivering the same reminder.
const dueQuery = (now) => ({
  type: { $in: ["task", "followup"] }, dueAt: { $ne: null, $lte: now }, completedAt: null,
  $and: [
    { $or: [{ reminderNotificationSentAt: null }, { reminderEmailSentAt: null }] },
    { $or: [{ reminderRetryAt: null }, { reminderRetryAt: { $lte: now } }] },
    { $or: [{ reminderLockedUntil: null }, { reminderLockedUntil: { $lte: now } }] },
  ],
});

export async function resolveLeadActivityReminder(leadId, activityId) {
  await AdminNotification.updateMany(
    { sourceType: "lead_activity", sourceId: `${leadId}:${activityId}`, resolvedAt: null },
    { $set: { resolvedAt: new Date() } },
  );
}

async function recipientFor(lead) {
  const owner = lead.ownerId ? await AdminUser.findOne({ _id: lead.ownerId, status: "active" }) : null;
  if (!owner) return null;
  const role = await getRoleForAdmin(owner);
  if (!roleHasPermission(role, "leads", "view") || !roleHasPermission(role, "tasks", "view")) return null;
  if (role.roleName === "Client Admin") {
    const client = await Client.findOne({ _id: lead.clientId, name: owner.client }).select("_id").lean();
    if (!client) return null;
  }
  return owner;
}

export async function runLeadReminderSweep({ now = new Date(), sendEmail = sendAdminLeadReminder } = {}) {
  const stats = { claimed: 0, notifications: 0, emails: 0 };
  const leads = await Lead.find({ activities: { $elemMatch: dueQuery(now) } })
    .select("practiceName ownerId clientId activities").limit(100).lean();
  for (const candidate of leads) {
    for (const activity of candidate.activities) {
      if (stats.claimed >= 100) return stats;
      if (!["task", "followup"].includes(activity.type) || !activity.dueAt || activity.dueAt > now || activity.completedAt) continue;
      if ((activity.reminderNotificationSentAt && activity.reminderEmailSentAt)
        || activity.reminderRetryAt > now || activity.reminderLockedUntil > now) continue;
      const token = crypto.randomUUID();
      const lead = await Lead.findOneAndUpdate(
        { _id: candidate._id, activities: { $elemMatch: { _id: activity._id, ...dueQuery(now) } } },
        { $set: { "activities.$.reminderLockedUntil": new Date(Date.now() + 5 * MINUTE), "activities.$.reminderLockToken": token } },
        { returnDocument: "after", timestamps: false },
      );
      if (!lead) continue;
      stats.claimed++;
      const current = lead.activities.id(activity._id);
      const lockFilter = { _id: lead._id, activities: { $elemMatch: { _id: current._id, reminderLockToken: token } } };
      const mark = (fields) => Lead.updateOne(lockFilter, { $set: Object.fromEntries(Object.entries(fields).map(([key, value]) => [`activities.$.${key}`, value])) }, { timestamps: false });
      try {
        const owner = await recipientFor(lead);
        if (!owner) {
          await mark({ reminderRetryAt: new Date(Date.now() + 60 * MINUTE) });
          continue;
        }
        const stillPending = () => Lead.exists({ _id: lead._id, ownerId: owner._id, activities: { $elemMatch: { _id: current._id, completedAt: null, reminderLockToken: token } } });
        if (!await stillPending()) continue;
        const actionPath = `/leads?leadId=${lead._id}`;
        if (!current.reminderNotificationSentAt) {
          await createAdminNotification({
            category: "lead", type: "warn",
            title: current.type === "followup" ? "Lead follow-up is due" : "Lead task is due",
            message: `${lead.practiceName}: ${current.title}`,
            actionUrl: actionPath, recipientUserIds: [owner._id], requiredPermission: "tasks:view",
            sourceType: "lead_activity", sourceId: `${lead._id}:${current._id}`,
            dedupeKey: `lead-reminder:${lead._id}:${current._id}:${owner._id}`,
          });
          await mark({ reminderNotificationSentAt: new Date() });
          stats.notifications++;
        }
        if (!await stillPending()) {
          await resolveLeadActivityReminder(lead._id, current._id);
          continue;
        }
        if (!current.reminderEmailSentAt) {
          const result = await sendEmail({
            to: owner.email, name: owner.name, practiceName: lead.practiceName,
            title: current.title, dueAt: current.dueAt, type: current.type, actionPath,
            messageId: `<lead-reminder-${lead._id}-${current._id}-${owner._id}@morlyiq.com>`,
          });
          if (result.sent) {
            await mark({ reminderEmailSentAt: new Date(), reminderRetryAt: null });
            stats.emails++;
          } else {
            await mark({ reminderRetryAt: new Date(Date.now() + 5 * MINUTE) });
          }
        }
      } catch (error) {
        console.error(`[Lead Reminder] Delivery failed for activity ${current._id}: ${error.name}`);
        await mark({ reminderRetryAt: new Date(Date.now() + 5 * MINUTE) });
      } finally {
        await mark({ reminderLockToken: null, reminderLockedUntil: null });
      }
    }
  }
  return stats;
}

export function startLeadReminderScheduler() {
  if (process.env.NODE_ENV === "test" || process.env.LEAD_REMINDERS_ENABLED === "false") return () => {};
  let running = false;
  const tick = async () => {
    if (running || mongoose.connection.readyState !== 1) return;
    running = true;
    try { await runLeadReminderSweep(); }
    catch (error) { console.error(`[Lead Reminder] Sweep failed: ${error.name}`); }
    finally { running = false; }
  };
  const timer = setInterval(tick, MINUTE);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
