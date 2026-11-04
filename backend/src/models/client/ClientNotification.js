import mongoose from "mongoose";
import { CLIENT_ROLES } from "./ClientUser.js";

export const NOTIFICATION_CATEGORIES = [
  "system",
  "verification",
  "appointment",
  "claim",
  "remittance",
  "insurance",
  "billing",
  "staff",
  "clinical",
  "schedule",
  "analytics",
  "product",
];

export const NOTIFICATION_TYPES = ["info", "success", "warn", "danger"];

const clientNotificationSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    // null means practice-wide; otherwise the alert belongs to one physical clinic.
    clinicId: { type: String, default: null, trim: true, index: true },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "info" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    // Empty means every role. Filtering is repeated server-side for every list/read request.
    audienceRoles: [{ type: String, enum: CLIENT_ROLES }],
    // Email recipients may differ from the in-app audience. Empty falls back to audienceRoles.
    emailAudienceRoles: [{ type: String, enum: CLIENT_ROLES }],
    // Empty means everyone matching audienceRoles. This supports future patient/staff assignments.
    recipientUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ClientUser" }],
    actionUrl: { type: String, default: "", trim: true, maxlength: 300 },
    sourceType: { type: String, default: "", trim: true, maxlength: 80 },
    sourceId: { type: String, default: "", trim: true, maxlength: 120 },
    dedupeKey: { type: String, default: null, trim: true },
    readBy: {
      type: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true },
        readAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "clientnotifications" },
);

clientNotificationSchema.index({ tenantId: 1, clinicId: 1, createdAt: -1 });
clientNotificationSchema.index(
  { tenantId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string" } } },
);

export const ClientNotification = mongoose.model("ClientNotification", clientNotificationSchema);
