import mongoose from "mongoose";
import { AdminNotification } from "../../../models/admin/AdminNotification.js";
import { Lead } from "../../../models/admin/Lead.js";
import { Ticket } from "../../../models/Ticket.js";
import { roleHasPermission } from "../../../services/admin/roleService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const visibilityQuery = (req) => {
  const userId = req.adminUser._id;
  const roleName = req.adminRole.roleName;
  const now = new Date();
  const query = {
    resolvedAt: null,
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      {
        $or: [
          { recipientUserIds: userId },
          { recipientUserIds: { $size: 0 }, audienceRoles: roleName },
        ],
      },
    ],
  };

  if (roleName !== "Super Admin") {
    const permissions = [...(req.adminPermissions || [])];
    query.$and.push({
      $or: [
        { requiredPermission: "" },
        { requiredPermission: { $in: permissions } },
      ],
    });
    query.$and.push({
      $or: [
        { clientName: "" },
        { clientName: req.adminUser.client || "__NO_CLIENT__" },
      ],
    });
  }
  return query;
};

const serialize = (notification, userId) => ({
  id: String(notification._id),
  category: notification.category,
  type: notification.type,
  title: notification.title,
  message: notification.message,
  actionUrl: notification.actionUrl || "",
  client: notification.clientName || null,
  read: (notification.readBy || []).some((entry) => String(entry.userId) === String(userId)),
  createdAt: notification.createdAt,
});

// Backfills existing actionable work once, using deterministic dedupe keys.
// Exact lead ownership and Super Admin-only ticket targeting remain enforced.
const reconcileCurrentWork = async (req) => {
  const jobs = [];
  if (roleHasPermission(req.adminRole, "leads", "view")) {
    const leads = await Lead.find({
      ownerId: req.adminUser._id,
      status: { $in: ["Open", "Follow-up"] },
    }).sort({ updatedAt: -1 }).limit(20).lean();
    for (const lead of leads) {
      jobs.push(notifyAdminSafely({
        category: "lead",
        type: lead.status === "Follow-up" ? "warn" : "info",
        title: lead.status === "Follow-up" ? "Lead follow-up required" : "Lead assigned to you",
        message: `${lead.practiceName} is currently ${lead.status.toLowerCase()}.`,
        actionUrl: "/leads",
        recipientUserIds: [req.adminUser._id],
        requiredPermission: "leads:view",
        sourceType: "lead",
        sourceId: String(lead._id),
        dedupeKey: `lead:${lead._id}:owner:${req.adminUser._id}:status:${lead.status}`,
      }));
    }
  }

  if (req.adminRole.roleName === "Super Admin") {
    const tickets = await Ticket.find({ status: { $in: ["open", "pending"] } })
      .sort({ updatedAt: -1 }).limit(20).lean();
    for (const ticket of tickets) {
      jobs.push(notifyAdminSafely({
        category: "support",
        type: ticket.priority === "high" ? "error" : ticket.priority === "medium" ? "warn" : "info",
        title: ticket.priority === "high" ? "High-priority support ticket" : "Support ticket needs attention",
        message: `${ticket.client}: ${ticket.subject}`,
        actionUrl: "/tickets",
        audienceRoles: ["Super Admin"],
        clientName: ticket.client,
        sourceType: "ticket",
        sourceId: String(ticket._id),
        dedupeKey: `ticket:${ticket._id}:created`,
      }));
    }
  }
  await Promise.all(jobs);
};

export const listNotifications = async (req, res) => {
  await reconcileCurrentWork(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
  const query = visibilityQuery(req);
  const [notifications, unreadCount] = await Promise.all([
    AdminNotification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
    AdminNotification.countDocuments({ ...query, "readBy.userId": { $ne: req.adminUser._id } }),
  ]);
  return res.status(200).json({
    success: true,
    count: notifications.length,
    data: {
      notifications: notifications.map((notification) => serialize(notification, req.adminUser._id)),
      unreadCount,
    },
  });
};

export const markNotificationRead = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ success: false, code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" });
  }
  const notification = await AdminNotification.findOne({
    _id: req.params.id,
    ...visibilityQuery(req),
  });
  if (!notification) {
    return res.status(404).json({ success: false, code: "NOTIFICATION_NOT_FOUND", message: "Notification not found" });
  }
  if (!(notification.readBy || []).some((entry) => String(entry.userId) === String(req.adminUser._id))) {
    notification.readBy.push({ userId: req.adminUser._id, readAt: new Date() });
    await notification.save();
  }
  return res.status(200).json({ success: true, message: "Notification marked as read", data: serialize(notification, req.adminUser._id) });
};

export const markAllNotificationsRead = async (req, res) => {
  const result = await AdminNotification.updateMany(
    { ...visibilityQuery(req), "readBy.userId": { $ne: req.adminUser._id } },
    { $push: { readBy: { userId: req.adminUser._id, readAt: new Date() } } }
  );
  return res.status(200).json({
    success: true,
    message: "Visible notifications marked as read",
    data: { updated: result.modifiedCount },
  });
};
