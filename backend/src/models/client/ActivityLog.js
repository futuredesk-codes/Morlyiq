import mongoose from "mongoose";

// Audit trail of what staff did in a practice, shown to the Owner on Security & Settings -> Activity log.
const activityLogSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    // Kept as plain text so the entry still reads correctly if the person is renamed or removed later
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", default: null },
    actorName: { type: String, required: true },
    action: { type: String, required: true }, // e.g. "Invited staff member"
    target: { type: String, default: "" }, // e.g. "Dr. Omar Farouk"
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ tenantId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);
