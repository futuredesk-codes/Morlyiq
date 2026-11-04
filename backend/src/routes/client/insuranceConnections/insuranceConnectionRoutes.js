import express from "express";
import { listInsuranceConnections } from "../../../controllers/client/insuranceConnections/insuranceConnectionController.js";
import { authorizeRoles, protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

router.get(
  "/",
  protectClient,
  scopeClinic,
  authorizeRoles("Owner", "Manager"),
  listInsuranceConnections
);

export default router;
