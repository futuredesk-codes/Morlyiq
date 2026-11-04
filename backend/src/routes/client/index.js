import express from "express";
import authRoutes from "./auth/authRoutes.js";
import ticketRoutes from "./tickets/ticketRoutes.js";
import staffRoutes from "./staff/staffRoutes.js";
import clinicRoutes from "./clinics/clinicRoutes.js";
import accountRoutes from "./account/accountRoutes.js";
import activityRoutes from "./activity/activityRoutes.js";
import patientRoutes from "./patients/patientRoutes.js";
import payerRoutes from "./payers/payerRoutes.js";
import billingRoutes from "./billing/billingRoutes.js";
import insuranceConnectionRoutes from "./insuranceConnections/insuranceConnectionRoutes.js";
import cdtRoutes from "./cdt/cdtRoutes.js";
import onboardingRoutes from "./onboarding/onboardingRoutes.js";
import notificationRoutes from "./notifications/notificationRoutes.js";
import dashboardRoutes from "./dashboard/dashboardRoutes.js";
import claimRoutes from "./claims/claimRoutes.js";
import eraRoutes from "./eras/eraRoutes.js";

// All Client Panel (MorlyCLient) API routes. Mounted at /api/client-panel.
// Kept separate from the Admin console routes in src/routes/admin.
const router = express.Router();

router.use("/auth", authRoutes);
router.use("/onboarding", onboardingRoutes);
router.use("/tickets", ticketRoutes);
router.use("/staff", staffRoutes);
router.use("/clinics", clinicRoutes);
router.use("/account", accountRoutes);
router.use("/patients", patientRoutes);
router.use("/payers", payerRoutes);
router.use("/billing", billingRoutes);
router.use("/insurance-connections", insuranceConnectionRoutes);
router.use("/cdt", cdtRoutes);
router.use("/activity", activityRoutes);
router.use("/notifications", notificationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/claims", claimRoutes);
router.use("/eras", eraRoutes);

export default router;
