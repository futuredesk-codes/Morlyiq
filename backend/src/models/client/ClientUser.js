import mongoose from "mongoose";
import { Client } from "../Client.js";

// Roles defined in MorlyCLient/src/constants/rbac.js
export const CLIENT_ROLES = ["Owner", "Manager", "Front Desk", "Billing", "Dentist"];

const clientUserSchema = new mongoose.Schema(
  {
    // Practice (tenant) this user belongs to — the same Client record the Admin console manages
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    // Role PER CLINIC. clinicId is a clinic code (cl1, cl2, ...) or "*" meaning every clinic of the
    // practice (used for the Owner, who is account-level). `active: false` = deactivated at that clinic.
    memberships: {
      type: [
        new mongoose.Schema(
          {
            clinicId: { type: String, required: true },
            role: { type: String, enum: CLIENT_ROLES, required: true },
            active: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Multi-factor authentication by email: a 6-digit code is emailed at login. Only the code's hash is stored.
    mfa: {
      enabled: { type: Boolean, default: false },
      emailCode: {
        hash: { type: String, select: false, default: null },
        expiresAt: { type: Date, select: false, default: null },
        sentAt: { type: Date, select: false, default: null },
      },
    },
    // Forgot password: a 6-digit code is emailed; only its hash is stored, valid 10 minutes, single use
    passwordReset: {
      hash: { type: String, select: false, default: null },
      expiresAt: { type: Date, select: false, default: null },
      sentAt: { type: Date, select: false, default: null },
    },
    passwordChangedAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "invited", "deactivated"], default: "active" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Keeps Client.users (shown in the Admin console) equal to the practice's non-deactivated users.
async function syncUserCount(tenantId) {
  if (!tenantId) return;
  const users = await ClientUser.countDocuments({ tenantId, status: { $ne: "deactivated" } });
  await Client.updateOne({ _id: tenantId }, { users });
}

clientUserSchema.post("save", (doc) => syncUserCount(doc.tenantId));
clientUserSchema.post("findOneAndUpdate", (doc) => syncUserCount(doc?.tenantId));
clientUserSchema.post("findOneAndDelete", (doc) => syncUserCount(doc?.tenantId));
clientUserSchema.post("deleteOne", { document: true, query: false }, (doc) => syncUserCount(doc.tenantId));

export const ClientUser = mongoose.model("ClientUser", clientUserSchema);
