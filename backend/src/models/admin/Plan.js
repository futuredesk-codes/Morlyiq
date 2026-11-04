import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true, immutable: true },
    name: { type: String, required: [true, "Plan name is required"], unique: true, trim: true },
    price: { type: Number, default: null, min: 0 },
    currency: { type: String, default: "USD", uppercase: true, trim: true },
    period: { type: String, required: true, trim: true },
    usageLimit: { type: Number, default: null, min: 0 },
    status: { type: String, enum: ["Draft", "Active", "Inactive", "Archived"], default: "Draft" },
    features: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

export const Plan = mongoose.model("Plan", planSchema);
