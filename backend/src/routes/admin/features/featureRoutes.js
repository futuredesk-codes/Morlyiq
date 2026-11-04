import express from "express";
import {
  createFeature,
  deleteFeature,
  getFeatures,
  updateFeature,
} from "../../../controllers/admin/features/featureController.js";

const router = express.Router();

router.route("/").get(getFeatures).post(createFeature);
router.route("/:id").patch(updateFeature).delete(deleteFeature);

export default router;
