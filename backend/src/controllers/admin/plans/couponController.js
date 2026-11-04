import { Coupon } from "../../../models/admin/Coupon.js";

export const getCoupons = async (req, res) => {
  const coupons = await Coupon.find().sort({ createdAt: -1 });
  return res.status(200).json({ success: true, count: coupons.length, data: coupons });
};

export const createCoupon = async (req, res) => {
  const code = String(req.body?.code || "").trim().toUpperCase();
  const expiresAt = new Date(req.body?.expiresAt || req.body?.expires);
  if (!code || Number.isNaN(expiresAt.getTime())) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Coupon code and a valid expiry date are required" });
  }
  const coupon = await Coupon.create({ code, pct: req.body.pct, expiresAt, active: req.body.active ?? true });
  return res.status(201).json({ success: true, message: "Coupon created", data: coupon });
};

export const updateCoupon = async (req, res) => {
  const changes = {};
  for (const key of ["pct", "active", "redemptions"]) {
    if (req.body?.[key] !== undefined) changes[key] = req.body[key];
  }
  if (req.body?.expiresAt !== undefined || req.body?.expires !== undefined) {
    const expiresAt = new Date(req.body.expiresAt || req.body.expires);
    if (Number.isNaN(expiresAt.getTime())) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Enter a valid expiry date" });
    }
    changes.expiresAt = expiresAt;
  }
  const coupon = await Coupon.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true });
  if (!coupon) return res.status(404).json({ success: false, code: "COUPON_NOT_FOUND", message: "Coupon not found" });
  return res.status(200).json({ success: true, message: "Coupon updated", data: coupon });
};

export const deleteCoupon = async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) return res.status(404).json({ success: false, code: "COUPON_NOT_FOUND", message: "Coupon not found" });
  return res.status(200).json({ success: true, message: "Coupon deleted", data: { id: String(coupon._id) } });
};
