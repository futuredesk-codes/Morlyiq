import mongoose from "mongoose";

const featureSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Feature key is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_]+$/, "Feature key can contain lowercase letters, numbers, and underscores only"],
    },
    name: {
      type: String,
      required: [true, "Feature name is required"],
      unique: true,
      trim: true,
    },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Feature = mongoose.model("Feature", featureSchema);
