import mongoose from "mongoose";

const clientInvitationSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      unique: true,
      index: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClientUser",
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["invited", "checkout_open", "paid", "completed", "expired"],
      default: "invited",
      index: true,
    },
    stripeCheckoutSessionId: { type: String, default: "", index: true },
    stripeCustomerId: { type: String, default: "" },
    stripeSubscriptionId: { type: String, default: "" },
    paidAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    emailSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ClientInvitation = mongoose.model("ClientInvitation", clientInvitationSchema);
