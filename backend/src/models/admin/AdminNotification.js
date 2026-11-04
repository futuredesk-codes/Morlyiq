import mongoose from "mongoose";

const readReceiptSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const adminNotificationSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ["lead", "support", "billing", "insurer", "access", "system"],
      default: "system",
      index: true,
    },
    type: { type: String, enum: ["info", "success", "warn", "error"], default: "info" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    actionUrl: { type: String, default: "", trim: true, maxlength: 300 },

    // Empty recipients means role audience. A non-empty recipient list is
    // exclusive: only those exact Admin users can receive the notification.
    recipientUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "AdminUser" }],
    audienceRoles: [{ type: String, trim: true }],

    // Permission is checked again on every list/read request. This prevents a
    // notification from exposing a resource after a role loses access.
    requiredPermission: { type: String, default: "", trim: true, index: true },
    clientName: { type: String, default: "", trim: true, index: true },

    sourceType: { type: String, default: "", trim: true },
    sourceId: { type: String, default: "", trim: true },
    dedupeKey: { type: String, default: "", trim: true },
    readBy: { type: [readReceiptSchema], default: [] },
    resolvedAt: { type: Date, default: null, index: true },
    expiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, collection: "adminnotifications" }
);

adminNotificationSchema.index({ createdAt: -1 });
adminNotificationSchema.index({ recipientUserIds: 1, createdAt: -1 });
adminNotificationSchema.index({ audienceRoles: 1, createdAt: -1 });
adminNotificationSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $gt: "" } } }
);

export const AdminNotification = mongoose.model("AdminNotification", adminNotificationSchema);
