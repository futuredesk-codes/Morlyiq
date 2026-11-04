import mongoose from "mongoose";

const adminSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "adminsessions" }
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AdminSession = mongoose.model("AdminSession", adminSessionSchema);
