import express from "express";
import {
  getSettings,
  setSuperAdminMfaPolicy,
} from "../../../controllers/admin/settings/settingsController.js";

const router = express.Router();

router.get("/", getSettings);
router.put("/security/super-admin-mfa", setSuperAdminMfaPolicy);

export default router;
