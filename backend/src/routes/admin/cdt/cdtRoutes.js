import express from "express";
import {
  createCdtCode,
  deleteCdtCode,
  getCdtCodes,
  updateCdtCode,
} from "../../../controllers/admin/cdt/cdtController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminPermission("eligibility", "view"), getCdtCodes);
router.post("/", requireAdminPermission("eligibility", "create"), createCdtCode);
router.patch("/:id", requireAdminPermission("eligibility", "edit"), updateCdtCode);
router.delete("/:id", requireAdminPermission("eligibility", "delete"), deleteCdtCode);

export default router;
