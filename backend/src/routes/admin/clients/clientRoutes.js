import express from "express";
import { createClient, getClients, updateClient } from "../../../controllers/admin/clients/clientController.js";

const router = express.Router();

router.route("/")
  .get(getClients)
  .post(createClient);

router.patch("/:id", updateClient);

export default router;
