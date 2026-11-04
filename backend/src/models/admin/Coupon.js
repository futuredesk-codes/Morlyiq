import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    pct: { type: Number, required: true, min: 1, max: 100 },
    redemptions: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", couponSchema);
