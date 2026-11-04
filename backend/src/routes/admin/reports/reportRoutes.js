import express from "express";
import { getReportOverview } from "../../../controllers/admin/reports/reportController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/overview", requireAdminPermission("reports", "view"), getReportOverview);

export default router;
