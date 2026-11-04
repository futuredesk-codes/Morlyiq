import express from "express";
import {
  confirmCheckout,
  createCheckout,
  createOwnerPassword,
  getOnboarding,
} from "../../../controllers/client/onboarding/onboardingController.js";

const router = express.Router();

router.get("/:token", getOnboarding);
router.post("/:token/checkout", createCheckout);
router.post("/:token/confirm-payment", confirmCheckout);
router.post("/:token/password", createOwnerPassword);

export default router;
