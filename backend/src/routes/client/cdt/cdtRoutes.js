import express from "express";
import { listCdtCodes } from "../../../controllers/client/cdt/cdtController.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

router.get("/", protectClient, listCdtCodes);

export default router;
