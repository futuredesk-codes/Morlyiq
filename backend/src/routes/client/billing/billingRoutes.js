import express from "express";
import { getSubscription } from "../../../controllers/client/billing/billingController.js";
import { protectClient, authorizeRoles } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

router.use(protectClient, scopeClinic, authorizeRoles("Owner", "Manager", "Billing"));
router.get("/subscription", getSubscription);

export default router;
