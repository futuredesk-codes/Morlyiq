import express from "express";
import { createCoupon, deleteCoupon, getCoupons, updateCoupon } from "../../../controllers/admin/plans/couponController.js";

const router = express.Router();

router.route("/").get(getCoupons).post(createCoupon);
router.route("/:id").patch(updateCoupon).delete(deleteCoupon);

export default router;
