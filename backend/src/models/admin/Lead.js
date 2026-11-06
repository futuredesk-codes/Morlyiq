import mongoose from "mongoose";

export const LEAD_STATUSES = ["Open", "Contacted", "Follow-up", "Won", "Lost"];
export const CALL_OUTCOMES = ["Interested", "Not interested", "No answer", "Voicemail", "Busy", "Wrong number", "Connected"];

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ["created", "status", "contact", "call", "followup", "task", "completed"], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true },
  actorName: { type: String, required: true },
  at: { type: Date, default: Date.now },
  title: { type: String, required: true, maxlength: 240 },
  notes: { type: String, default: "", maxlength: 4000 },
  outcome: { type: String, enum: CALL_OUTCOMES },
  durationMinutes: { type: Number, min: 0, max: 1440 },
  dueAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  reminderNotificationSentAt: { type: Date, default: null },
  reminderEmailSentAt: { type: Date, default: null },
  reminderRetryAt: { type: Date, default: null },
  reminderLockedUntil: { type: Date, default: null },
  reminderLockToken: { type: String, default: null, select: false },
  relatedType: { type: String, enum: ["followup", "task"] },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
});

const leadSchema = new mongoose.Schema(
  {
    phone: { type: String, default: "", maxlength: 24 },
    // Tenant association for delegated Client Admin access; legacy platform leads stay unscoped.
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    activities: { type: [activitySchema], default: [] },
    practiceName: {
      type: String,
      required: [true, "Practice name is required"],
      trim: true,
      maxlength: [160, "Practice name is too long"],
    },
    contactName: {
      type: String,
      required: [true, "Contact name is required"],
      trim: true,
      maxlength: [160, "Contact name is too long"],
    },
    source: {
      type: String,
      required: [true, "Lead source is required"],
      trim: true,
      maxlength: [120, "Lead source is too long"],
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
      default: null,
      index: true,
    },
    ownerName: {
      type: String,
      required: [true, "Lead owner is required"],
      trim: true,
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "Open",
      index: true,
    },
    lastActivityLabel: {
      type: String,
      default: "Lead created",
      trim: true,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true, collection: "adminleads" }
);

export const Lead = mongoose.model("AdminLead", leadSchema);
