import express from "express";
import { createAuditLog, getAuditLogs } from "../../../controllers/admin/audit/auditController.js";
import { requireAdminRoles } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminRoles("Super Admin"), getAuditLogs);
router.post("/", createAuditLog);

export default router;
