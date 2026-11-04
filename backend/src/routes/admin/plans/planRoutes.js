import express from "express";
import { createPlan, deletePlan, getPlans, updatePlan } from "../../../controllers/admin/plans/planController.js";

const router = express.Router();

router.route("/").get(getPlans).post(createPlan);
router.route("/:key").patch(updatePlan).delete(deletePlan);

export default router;
