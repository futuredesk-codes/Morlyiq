import express from "express";
import authRoutes from "./auth/authRoutes.js";
import clientRoutes from "./clients/clientRoutes.js";
import ticketRoutes from "./tickets/ticketRoutes.js";
import featureRoutes from "./features/featureRoutes.js";
import planRoutes from "./plans/planRoutes.js";
import couponRoutes from "./plans/couponRoutes.js";
import userRoutes from "./users/userRoutes.js";
import roleRoutes from "./roles/roleRoutes.js";
import cdtRoutes from "./cdt/cdtRoutes.js";
import leadRoutes from "./leads/leadRoutes.js";
import externalLinkRoutes from "./externalLinks/externalLinkRoutes.js";
import announcementRoutes from "./announcements/announcementRoutes.js";
import settingsRoutes from "./settings/settingsRoutes.js";
import auditRoutes from "./audit/auditRoutes.js";
import insurerRoutes from "./insurers/insurerRoutes.js";
import notificationRoutes from "./notifications/notificationRoutes.js";
import reportRoutes from "./reports/reportRoutes.js";
import dashboardRoutes from "./dashboard/dashboardRoutes.js";
import searchRoutes from "./search/searchRoutes.js";
import { protectAdmin, requireAdminRoles } from "../../middlewares/admin/adminAuth.js";

// All Admin Console (Admin) API routes. Mounted at /api (keeps /api/auth, /api/clients, /api/tickets).
// Client Panel routes live separately in src/routes/client.
const router = express.Router();

router.use("/auth", authRoutes);
router.use(protectAdmin);
router.use("/search", searchRoutes);
const superAdminOnly = requireAdminRoles("Super Admin");
router.use("/clients", superAdminOnly, clientRoutes);
router.use("/features", superAdminOnly, featureRoutes);
router.use("/plans", superAdminOnly, planRoutes);
router.use("/coupons", superAdminOnly, couponRoutes);
router.use("/users", superAdminOnly, userRoutes);
router.use("/insurers", superAdminOnly, insurerRoutes);
router.use("/roles", roleRoutes);
router.use("/cdt", cdtRoutes);
router.use("/leads", leadRoutes);
router.use("/external-links", externalLinkRoutes);
router.use("/announcements", superAdminOnly, announcementRoutes);
router.use("/settings", superAdminOnly, settingsRoutes);
router.use("/tickets", superAdminOnly, ticketRoutes);
router.use("/audit-logs", auditRoutes);
router.use("/notifications", notificationRoutes);
router.use("/reports", reportRoutes);
router.use("/dashboard", dashboardRoutes);

export default router;
