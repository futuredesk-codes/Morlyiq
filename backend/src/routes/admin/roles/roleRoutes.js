import express from "express";
import {
  createRole,
  deleteRole,
  getRoles,
  updateRole,
} from "../../../controllers/admin/roles/roleController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminPermission("users", "administer"), getRoles);
router.post("/", requireAdminPermission("users", "administer"), createRole);
router.patch("/:id", requireAdminPermission("users", "administer"), updateRole);
router.delete("/:id", requireAdminPermission("users", "administer"), deleteRole);

export default router;
