import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    supportEmail: { type: String, default: "support@dentalverify.ai", trim: true, lowercase: true, maxlength: 254 },
    trialLengthDays: { type: Number, default: 14, min: 1, max: 365 },
    verificationProvider: { type: String, enum: ["stedi"], default: "stedi" },
    maintenanceMode: { type: Boolean, default: false },
    allowSignups: { type: Boolean, default: true },
    security: {
      requireMfaForSuperAdmins: { type: Boolean, default: false },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true, collection: "platformsettings" }
);

export const PlatformSettings = mongoose.model("PlatformSettings", platformSettingsSchema);
