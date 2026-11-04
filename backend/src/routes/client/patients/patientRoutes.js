import express from "express";
import {
  listPatients,
  createPatient,
  importPatients,
  updatePatient,
  saveSecondaryInsurance,
  removeSecondaryInsurance,
  verifyEligibility,
  submitClaim,
} from "../../../controllers/client/patients/patientController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

// Clinic-scoped: needs the X-Clinic-Id header, and the user must have a role at that clinic
router.use(protectClient, scopeClinic);
router.route("/").get(listPatients).post(createPatient);
router.post("/import", importPatients);
router
  .route("/:id/secondary-insurance")
  .put(saveSecondaryInsurance)
  .delete(removeSecondaryInsurance);
router.post("/:id/eligibility", verifyEligibility);
router.post("/:id/claim-submission", submitClaim);
router.patch("/:id", updatePatient);

export default router;
