import express from "express";
import {
  createExternalLink,
  deleteExternalLink,
  getExternalLinks,
  updateExternalLink,
} from "../../../controllers/admin/externalLinks/externalLinkController.js";
import { requireAdminPermission } from "../../../middlewares/admin/adminAuth.js";

const router = express.Router();

router.get("/", requireAdminPermission("external_links", "view"), getExternalLinks);
router.post("/", requireAdminPermission("external_links", "create"), createExternalLink);
router.patch("/:id", requireAdminPermission("external_links", "edit"), updateExternalLink);
router.delete("/:id", requireAdminPermission("external_links", "delete"), deleteExternalLink);

export default router;
