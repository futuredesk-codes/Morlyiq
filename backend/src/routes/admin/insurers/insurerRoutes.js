import express from "express";
import {
  createInsurer,
  listInsurerDirectory,
  listInsurers,
  updateInsurerStatus,
} from "../../../controllers/admin/insurers/insurerController.js";

const router = express.Router();

router.get("/", listInsurers);
router.get("/directory", listInsurerDirectory);
router.post("/", createInsurer);
router.patch("/:id/status", updateInsurerStatus);

export default router;
