import express from "express";
import {
  listClinics,
  createClinic,
  getClaimProvider,
  refreshClaimProviderStediStatus,
  syncClaimProviderWithStedi,
  updateClinic,
  updateClaimProvider,
} from "../../../controllers/client/clinics/clinicController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

// Clinics are account-level: no X-Clinic-Id needed, access is checked per clinic in the controller
router.use(protectClient);
router.route("/").get(listClinics).post(createClinic);
router.route("/:clinicId/claim-provider").get(getClaimProvider).patch(updateClaimProvider);
router.post("/:clinicId/claim-provider/stedi-sync", syncClaimProviderWithStedi);
router.post("/:clinicId/claim-provider/stedi-refresh", refreshClaimProviderStediStatus);
router.patch("/:clinicId", updateClinic);

export default router;
