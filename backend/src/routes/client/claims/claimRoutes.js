import express from "express";
import {
  createClaim,
  getClaimsConfiguration,
  getClaim,
  listClaims,
  submitClaimToStedi,
  updateClaim,
  validateClaimForSubmission,
} from "../../../controllers/client/claims/claimController.js";
import { authorizeRoles, protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

router.use(protectClient, scopeClinic, authorizeRoles("Owner", "Manager", "Billing", "Front Desk"));
router.get("/configuration", getClaimsConfiguration);
router.route("/").get(listClaims).post(createClaim);
router.route("/:id").get(getClaim).patch(updateClaim);
router.post("/:id/validate", validateClaimForSubmission);
router.post("/:id/submit", authorizeRoles("Owner", "Manager", "Billing"), submitClaimToStedi);

export default router;

