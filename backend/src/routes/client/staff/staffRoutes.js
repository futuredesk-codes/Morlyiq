import express from "express";
import { listStaff, inviteStaff, updateStaff } from "../../../controllers/client/staff/staffController.js";
import { protectClient, authorizeRoles } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

// Staff & Roles page is Owner / Manager only — judged by the role at the ACTIVE clinic (matches NAV_ACCESS.staff in MorlyCLient)
router.use(protectClient, scopeClinic, authorizeRoles("Owner", "Manager"));
router.route("/").get(listStaff).post(inviteStaff);
router.patch("/:id", updateStaff);

export default router;
