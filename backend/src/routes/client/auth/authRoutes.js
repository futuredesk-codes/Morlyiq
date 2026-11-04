import express from "express";
import { login, forgotPassword, resetPassword, verifyMfaLogin, resendMfaLogin, logout, me } from "../../../controllers/client/auth/authController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/mfa/verify", verifyMfaLogin);
router.post("/mfa/resend", resendMfaLogin);
router.post("/logout", protectClient, logout);
router.get("/me", protectClient, me);

export default router;
