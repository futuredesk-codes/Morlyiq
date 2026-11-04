import { ClientNotification } from "../../../models/client/ClientNotification.js";
import { NotificationPreference } from "../../../models/client/NotificationPreference.js";
import { Announcement } from "../../../models/admin/Announcement.js";
import { ExternalLink } from "../../../models/admin/ExternalLink.js";
import { Plan } from "../../../models/admin/Plan.js";
import { ok, fail, invalid } from "../../../utils/client/apiResponse.js";
import { emailPreferenceKeysForRole } from "../../../services/client/notificationService.js";

const tenantIdOf = (req) => req.user.tenantId._id;

const visibleNotificationQuery = (req) => ({
  tenantId: tenantIdOf(req),
  $and: [
    { $or: [{ clinicId: null }, { clinicId: req.clinicId }] },
    { $or: [{ audienceRoles: { $size: 0 } }, { audienceRoles: req.clinicRole }] },
    { $or: [{ recipientUserIds: { $size: 0 } }, { recipientUserIds: req.user._id }] },
    { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
  ],
});

const serializeNotification = (notification, userId) => ({
  id: String(notification._id),
  clinicId: notification.clinicId || null,
  category: notification.category,
  type: notification.type,
  title: notification.title,
  text: notification.message,
  actionUrl: notification.actionUrl || "",
  read: (notification.readBy || []).some((entry) => String(entry.userId) === String(userId)),
  createdAt: notification.createdAt,
});

const serializePreferences = (preferences) => ({
  verifications: preferences?.email?.verifications ?? true,
  billing: preferences?.email?.billing ?? true,
  staff: preferences?.email?.staff ?? false,
  product: preferences?.email?.product ?? true,
});

const getOrCreatePreferences = (req) => NotificationPreference.findOneAndUpdate(
  { userId: req.user._id },
  { $setOnInsert: { tenantId: tenantIdOf(req) } },
  { upsert: true, new: true, setDefaultsOnInsert: true },
);

const serializeAnnouncement = (announcement) => ({
  id: String(announcement._id),
  title: announcement.title,
  body: announcement.body,
  audience: announcement.audience,
  publishedAt: announcement.publishedAt || announcement.updatedAt || announcement.createdAt,
});

const serializeExternalLink = (link) => ({
  id: String(link._id),
  title: link.title,
  url: link.url,
  openMode: link.openMode,
  ssoType: link.ssoType,
});

export const getNotificationContent = async (req, res) => {
  const tenant = req.user.tenantId;
  const plan = tenant.planId ? await Plan.findOne({ key: tenant.planId }).select("_id").lean() : null;
  const audienceFilters = [{ audience: "All clients" }];

  if (tenant.status === "trial") audienceFilters.push({ audience: "Trial accounts" });
  if (plan?._id) audienceFilters.push({ audience: "Selected plans", targetPlans: plan._id });

  const [announcements, externalLinks] = await Promise.all([
    Announcement.find({ published: true, $or: audienceFilters })
      .select("title body audience publishedAt createdAt updatedAt")
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean(),
    ExternalLink.find({
      enabled: true,
      setupStatus: "ready",
      assignedClients: tenant._id,
      $or: [{ restrictedRoles: { $size: 0 } }, { restrictedRoles: req.clinicRole }],
    })
      .select("title url openMode ssoType")
      .sort({ title: 1 })
      .lean(),
  ]);

  return ok(res, "Notification page content loaded", {
    announcements: announcements.map(serializeAnnouncement),
    externalLinks: externalLinks.map(serializeExternalLink),
    role: req.clinicRole,
    clinicId: req.clinicId,
  });
};

export const listNotifications = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const notifications = await ClientNotification.find(visibleNotificationQuery(req))
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const rows = notifications.map((notification) => serializeNotification(notification, req.user._id));
  return ok(res, "Notifications loaded", {
    notifications: rows,
    unreadCount: rows.filter((notification) => !notification.read).length,
    role: req.clinicRole,
    clinicId: req.clinicId,
  });
};

export const markNotificationRead = async (req, res) => {
  const notification = await ClientNotification.findOne({
    _id: req.params.id,
    ...visibleNotificationQuery(req),
  }).catch(() => null);
  if (!notification) {
    return fail(res, 404, "Notification not found", { code: "NOTIFICATION_NOT_FOUND" });
  }
  if (!(notification.readBy || []).some((entry) => String(entry.userId) === String(req.user._id))) {
    notification.readBy.push({ userId: req.user._id, readAt: new Date() });
    await notification.save();
  }
  return ok(res, "Notification marked as read", serializeNotification(notification, req.user._id));
};

export const markAllNotificationsRead = async (req, res) => {
  const result = await ClientNotification.updateMany(
    { ...visibleNotificationQuery(req), "readBy.userId": { $ne: req.user._id } },
    { $push: { readBy: { userId: req.user._id, readAt: new Date() } } },
  );
  return ok(res, "All visible notifications marked as read", { updated: result.modifiedCount });
};

export const getNotificationPreferences = async (req, res) => {
  const preferences = await getOrCreatePreferences(req);
  return ok(res, "Notification preferences loaded", {
    email: serializePreferences(preferences),
    available: emailPreferenceKeysForRole(req.clinicRole),
    role: req.clinicRole,
  });
};

export const updateNotificationPreferences = async (req, res) => {
  const allowed = ["verifications", "billing", "staff", "product"];
  const available = emailPreferenceKeysForRole(req.clinicRole);
  const supplied = Object.fromEntries(allowed
    .filter((key) => req.body?.email?.[key] !== undefined)
    .map((key) => [key, req.body.email[key]]));
  const invalidKey = Object.entries(supplied).find(([, value]) => typeof value !== "boolean");
  if (!Object.keys(supplied).length || invalidKey) {
    return invalid(res, [{ field: `email.${invalidKey?.[0] || "preferences"}`, message: "Provide valid email notification preferences" }]);
  }
  const forbiddenKey = Object.keys(supplied).find((key) => !available.includes(key));
  if (forbiddenKey) {
    return fail(res, 403, `${forbiddenKey} email alerts are not available for the ${req.clinicRole} role`, {
      code: "NOTIFICATION_PREFERENCE_NOT_ALLOWED",
    });
  }
  const $set = Object.fromEntries(Object.entries(supplied).map(([key, value]) => [`email.${key}`, value]));
  const preferences = await NotificationPreference.findOneAndUpdate(
    { userId: req.user._id },
    { $set, $setOnInsert: { tenantId: tenantIdOf(req) } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return ok(res, "Notification preferences updated", {
    email: serializePreferences(preferences),
    available,
    role: req.clinicRole,
  });
};
