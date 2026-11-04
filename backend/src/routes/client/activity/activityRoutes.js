import express from "express";
import { listActivity } from "../../../controllers/client/activity/activityController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

// Practice-level (Owner only, checked in the controller), so no X-Clinic-Id is needed.
router.get("/", protectClient, listActivity);

export default router;
