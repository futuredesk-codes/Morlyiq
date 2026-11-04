import mongoose from "mongoose";

const platformInsurerSchema = new mongoose.Schema(
  {
    payerStediId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    primaryPayerId: { type: String, required: true, trim: true },
    configuredStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true, collection: "platform_insurers" }
);

platformInsurerSchema.index({ configuredStatus: 1, name: 1 });

export const PlatformInsurer = mongoose.model("PlatformInsurer", platformInsurerSchema);
