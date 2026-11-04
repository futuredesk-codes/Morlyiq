import express from "express";
import {
  forgotPassword,
  getProfile,
  login,
  logout,
  resendMfaLogin,
  resetPassword,
  verifyMfaLogin,
} from "../../../controllers/admin/auth/authController.js";
import { protectAdmin } from "../../../middlewares/admin/adminAuth.js";
import { acceptAdminInvitation, getAdminInvitation } from "../../../controllers/admin/auth/invitationController.js";

const router = express.Router();

router.post("/login", login);
router.post("/mfa/verify", verifyMfaLogin);
router.post("/mfa/resend", resendMfaLogin);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/invitations/:token", getAdminInvitation);
router.post("/invitations/:token/accept", acceptAdminInvitation);
router.get("/profile", protectAdmin, getProfile);
router.post("/logout", protectAdmin, logout);

export default router;
