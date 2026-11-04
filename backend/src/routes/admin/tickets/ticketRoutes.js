import express from "express";
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  addReply,
  deleteTicket,
} from "../../../controllers/admin/tickets/ticketController.js";

const router = express.Router();

// GET all tickets & POST create new ticket
router.route("/").get(getTickets).post(createTicket);

// GET single ticket & DELETE ticket
router.route("/:id").get(getTicketById).delete(deleteTicket);

// PATCH update ticket status
router.patch("/:id/status", updateTicketStatus);

// POST add reply to ticket
router.post("/:id/reply", addReply);

export default router;
