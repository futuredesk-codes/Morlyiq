import mongoose from "mongoose";

// One document per login. The JWT carries the session id (`sid`); revoking the document signs that device out.
const clientSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    device: { type: String, default: "Unknown device" }, // e.g. "Chrome · Windows"
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    lastActiveAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Mongo removes expired sessions on its own
clientSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ClientSession = mongoose.model("ClientSession", clientSessionSchema);
