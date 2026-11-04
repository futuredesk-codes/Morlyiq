import express from "express";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";
import {
  getNotificationPreferences,
  getNotificationContent,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from "../../../controllers/client/notifications/notificationController.js";

const router = express.Router();

router.use(protectClient, scopeClinic);
router.get("/", listNotifications);
router.get("/content", getNotificationContent);
router.post("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);
router.get("/preferences/email", getNotificationPreferences);
router.put("/preferences/email", updateNotificationPreferences);

export default router;
