import express from "express";
import adminPanelRoutes from "./admin/index.js";
import clientPanelRoutes from "./client/index.js";

const router = express.Router();

// Health Check
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: "MorlyIQ Backend API",
  });
});

// Each panel owns its own routes, controllers and models
router.use("/client-panel", clientPanelRoutes); // MorlyCLient: /api/client-panel/*
router.use(adminPanelRoutes); // Admin: /api/auth, /api/clients, /api/tickets

export default router;
