import express from "express";
import { getEraPdf, listEras } from "../../../controllers/client/eras/eraController.js";
import { authorizeRoles, protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

router.use(protectClient, scopeClinic, authorizeRoles("Owner", "Manager", "Billing", "Front Desk"));
router.get("/", listEras);
router.get("/:transactionId/pdf", getEraPdf);

export default router;

