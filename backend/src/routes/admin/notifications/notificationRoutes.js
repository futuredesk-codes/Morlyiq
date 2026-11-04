import express from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../../controllers/admin/notifications/notificationController.js";

const router = express.Router();

router.get("/", listNotifications);
router.post("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

export default router;
