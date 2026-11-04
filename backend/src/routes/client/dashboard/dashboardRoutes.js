import express from "express";
import { getDashboardStats } from "../../../controllers/client/dashboard/dashboardController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";

const router = express.Router();

router.get("/stats", protectClient, scopeClinic, getDashboardStats);

export default router;
