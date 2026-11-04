import mongoose from "mongoose";

const platformSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    security: {
      requireMfaForSuperAdmins: { type: Boolean, default: false },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "AdminUser", default: null },
  },
  { timestamps: true, collection: "platformsettings" }
);

export const PlatformSettings = mongoose.model("PlatformSettings", platformSettingsSchema);
