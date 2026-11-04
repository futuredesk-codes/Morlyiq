import mongoose from "mongoose";

const notificationPreferenceSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "ClientUser", required: true, unique: true, index: true },
    email: {
      verifications: { type: Boolean, default: true },
      billing: { type: Boolean, default: true },
      staff: { type: Boolean, default: false },
      product: { type: Boolean, default: true },
    },
  },
  { timestamps: true, collection: "notificationpreferences" },
);

export const NotificationPreference = mongoose.model("NotificationPreference", notificationPreferenceSchema);
