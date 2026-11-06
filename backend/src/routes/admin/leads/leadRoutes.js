import express from "express";
import {
  createLead,
  getLeads,
  getLead,
  updateLead,
  addLeadActivity,
  completeLeadActivity,
} from "../../../controllers/admin/leads/leadController.js";
import { requireAdminPermission, requireAnyAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminPermission("leads", "view"), getLeads);
router.post("/", requireAdminPermission("leads", "create"), createLead);
router.use(requireAdminPermission("leads", "view"));
router.get("/:id", getLead);
router.patch("/:id", requireAdminPermission("leads", "edit"), updateLead);
router.post("/:id/activities", addLeadActivity);
router.post("/:id/activities/:activityId/complete", requireAdminPermission("tasks", "view"), requireAnyAdminPermission("tasks", "edit", "execute"), completeLeadActivity);

export default router;
