import express from "express";
import {
  createLead,
  getLeads,
} from "../../../controllers/admin/leads/leadController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminPermission("leads", "view"), getLeads);
router.post("/", requireAdminPermission("leads", "create"), createLead);

export default router;
