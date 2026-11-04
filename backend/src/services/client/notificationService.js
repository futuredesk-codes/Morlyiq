import { ClientNotification } from "../../models/client/ClientNotification.js";
import { CLIENT_ROLES, ClientUser } from "../../models/client/ClientUser.js";
import { NotificationPreference } from "../../models/client/NotificationPreference.js";
import { sendClientNotificationEmail } from "./emailService.js";

const uniqueRoles = (roles) => [...new Set((Array.isArray(roles) ? roles : []).filter((role) => CLIENT_ROLES.includes(role)))];

export const EMAIL_PREFERENCE_ROLES = Object.freeze({
  verifications: ["Owner", "Manager", "Front Desk", "Dentist", "Billing"],
  billing: ["Owner", "Manager", "Billing"],
  staff: ["Owner", "Manager"],
  product: [...CLIENT_ROLES],
});

export const emailPreferenceKeysForRole = (role) =>
  Object.entries(EMAIL_PREFERENCE_ROLES)
    .filter(([, roles]) => roles.includes(role))
    .map(([key]) => key);

const preferenceForCategory = (category) => {
  if (category === "verification") return "verifications";
  if (["billing", "claim", "remittance", "insurance"].includes(category)) return "billing";
  if (category === "staff") return "staff";
  if (["product", "system"].includes(category)) return "product";
  return null;
};

const defaultEmailPreference = (key) => key !== "staff";

async function deliverNotificationEmails(notification) {
  const preferenceKey = preferenceForCategory(notification.category);
  if (!preferenceKey || !process.env.SMTP_HOST) return;

  const membershipMatch = notification.clinicId
    ? { memberships: { $elemMatch: { active: true, clinicId: { $in: [notification.clinicId, "*"] } } } }
    : { memberships: { $elemMatch: { active: true } } };
  const users = await ClientUser.find({ tenantId: notification.tenantId, status: "active", ...membershipMatch })
    .select("name email memberships")
    .lean();
  const targetedIds = new Set((notification.recipientUserIds || []).map(String));
  const configuredEmailAudience = notification.emailAudienceRoles?.length
    ? notification.emailAudienceRoles
    : notification.audienceRoles;
  const audience = new Set(configuredEmailAudience || []);
  const recipients = users.filter((user) => {
    if (targetedIds.size && !targetedIds.has(String(user._id))) return false;
    return (user.memberships || []).some((membership) =>
      membership.active
      && (!notification.clinicId || [notification.clinicId, "*"].includes(membership.clinicId))
      && (!audience.size || audience.has(membership.role))
      && EMAIL_PREFERENCE_ROLES[preferenceKey].includes(membership.role));
  });
  if (!recipients.length) return;

  const preferences = await NotificationPreference.find({ userId: { $in: recipients.map((user) => user._id) } }).lean();
  const preferenceByUser = new Map(preferences.map((item) => [String(item.userId), item]));
  await Promise.allSettled(recipients.map((user) => {
    const preference = preferenceByUser.get(String(user._id));
    const enabled = preference?.email?.[preferenceKey] ?? defaultEmailPreference(preferenceKey);
    if (!enabled) return Promise.resolve();
    return sendClientNotificationEmail({
      to: user.email,
      name: user.name,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
    });
  }));
}

export const createClientNotification = async ({
  tenantId,
  clinicId = null,
  category,
  type = "info",
  title,
  message,
  audienceRoles = [],
  emailAudienceRoles = [],
  recipientUserIds = [],
  actionUrl = "",
  sourceType = "",
  sourceId = "",
  dedupeKey = null,
  expiresAt = null,
}) => {
  const notification = await ClientNotification.create({
    tenantId,
    clinicId: clinicId || null,
    category,
    type,
    title,
    message,
    audienceRoles: uniqueRoles(audienceRoles),
    emailAudienceRoles: uniqueRoles(emailAudienceRoles),
    recipientUserIds,
    actionUrl,
    sourceType,
    sourceId: sourceId ? String(sourceId) : "",
    dedupeKey,
    expiresAt,
  });
  // SMTP runs after the durable in-app notification exists and cannot delay or
  // roll back the originating eligibility/claim/staff action.
  deliverNotificationEmails(notification).catch((error) => {
    console.error(`[Client Notification Email] ${error.message}`);
  });
  return notification;
};

// Notifications must never roll back the business action that produced them.
export const notifyClientSafely = (payload) =>
  createClientNotification(payload).catch((error) => {
    if (error?.code !== 11000) {
      console.error(`[Client Notification] ${error.message}`);
    }
    return null;
  });
