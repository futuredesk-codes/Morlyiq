import express from "express";
import { getTickets, createTicket } from "../../../controllers/client/tickets/ticketController.js";
import { scopeClinic } from "../../../middlewares/client/clinic/clinicAccess.js";
import { protectClient } from "../../../middlewares/client/auth/clientAuth.js";

const router = express.Router();

// Every role can raise and read tickets; what they see depends on their role at the active clinic
router.use(protectClient, scopeClinic);
router.route("/").get(getTickets).post(createTicket);

export default router;
