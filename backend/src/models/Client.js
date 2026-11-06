import mongoose from "mongoose";
import { getPlatformSettings } from "../services/admin/platformSettingsService.js";

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Client name is required"],
      trim: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      default: "",
      index: true,
    },
    clinics: {
      type: Number,
      default: 1,
      min: 1,
    },
    planId: {
      type: String,
      default: "pl1",
    },
    status: {
      type: String,
      enum: ["invited", "active", "trial", "past_due", "suspended", "archived"],
      default: "trial",
    },
    trialStartedAt: { type: Date, default: null },
    trialEndsAt: { type: Date, default: null },
    mrr: {
      type: Number,
      default: 0,
    },
    users: {
      type: Number,
      default: 1,
    },
    verifications: {
      type: Number,
      default: 0,
    },
    // Practice-wide security policy, set by the practice Owner in the Client Panel
    securityPolicy: {
      requireMfa: { type: Boolean, default: false },
    },
    entitlements: {
      type: Map,
      of: Boolean,
      default: {},
    },
    billing: {
      paymentStatus: {
        type: String,
        enum: ["not_started", "pending", "paid", "failed", "refunded"],
        default: "not_started",
      },
      stripeCustomerId: { type: String, default: "", select: false },
      stripeCheckoutSessionId: { type: String, default: "", select: false },
      stripeSubscriptionId: { type: String, default: "", select: false },
      paidAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

clientSchema.pre("validate", async function initializeTrial() {
  if (this.status !== "trial" || this.trialEndsAt) return;
  const settings = await getPlatformSettings();
  this.trialStartedAt = this.trialStartedAt || new Date();
  this.trialEndsAt = new Date(this.trialStartedAt.getTime() + (settings.trialLengthDays ?? 14) * 86400000);
});

export const Client = mongoose.model("Client", clientSchema);
