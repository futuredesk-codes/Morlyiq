import express from "express";
import { listDentalPayers } from "../../../controllers/client/payers/payerController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

router.get("/", protectClient, listDentalPayers);

export default router;
