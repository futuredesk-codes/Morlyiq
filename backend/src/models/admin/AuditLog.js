import mongoose from "mongoose";

export const AUDIT_LEVELS = ["info", "warn", "error"];

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null, index: true },
    actorName: { type: String, required: true, trim: true },
    actorEmail: { type: String, required: true, lowercase: true, trim: true },
    actorRole: { type: String, required: true, trim: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", default: null, index: true },
    clientName: { type: String, default: "", trim: true },
    action: { type: String, required: true, trim: true, maxlength: 160 },
    target: { type: String, default: "", trim: true, maxlength: 1000 },
    level: { type: String, enum: AUDIT_LEVELS, default: "info", index: true },
    source: { type: String, default: "admin_console", trim: true },
    ipAddress: { type: String, default: "", trim: true },
    userAgent: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "adminauditlogs",
  }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ clientId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
