import express from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} from "../../../controllers/admin/announcements/announcementController.js";

const router = express.Router();

router.route("/").get(getAnnouncements).post(createAnnouncement);
router.route("/:id").patch(updateAnnouncement).delete(deleteAnnouncement);

export default router;
