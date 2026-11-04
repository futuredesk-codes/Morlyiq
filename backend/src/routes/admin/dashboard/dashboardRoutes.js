import express from "express";
import { getAdminDashboardStats } from "../../../controllers/admin/dashboard/dashboardController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/stats", requireAdminPermission("dashboard", "view"), getAdminDashboardStats);

export default router;
