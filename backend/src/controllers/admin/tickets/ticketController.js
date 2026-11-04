import { Ticket } from "../../../models/Ticket.js";

// Helper for human-readable relative time (matches MorlyIQ frontend style)
function formatTimeAgo(date) {
  if (!date) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTicket(ticket) {
  const obj = ticket.toObject ? ticket.toObject() : { ...ticket };

  // Fallback to latest reply if response field was not set on older tickets
  const lastReply = obj.replies && obj.replies.length > 0 ? obj.replies[obj.replies.length - 1] : null;
  const response = obj.response || (lastReply ? lastReply.message : "");
  const respondedAt = obj.respondedAt || (lastReply ? lastReply.createdAt : null);
  const respondedBy = obj.respondedBy || (lastReply ? lastReply.sender : "");

  return {
    ...obj,
    id: obj.ticketId || (obj._id ? obj._id.toString() : obj.id),
    updated: formatTimeAgo(obj.updatedAt || obj.createdAt) || "just now",
    response,
    respondedAt,
    respondedBy,
    respondedTimeAgo: formatTimeAgo(respondedAt),
  };
}

/**
 * GET /api/tickets
 * Fetch all tickets directly from database with optional filtering by status/priority/search
 */
export const getTickets = async (req, res) => {
  try {
    const { status, priority, search } = req.query;
    const filter = {};

    if (status && status !== "all") {
      filter.status = status;
    }
    if (priority && priority !== "all") {
      filter.priority = priority;
    }
    if (search) {
      filter.subject = { $regex: search, $options: "i" };
    }

    let tickets = [];
    try {
      tickets = await Ticket.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    } catch (dbErr) {
      console.warn("[TicketController] Fallback DB query warning:", dbErr.message);
    }

    const formatted = tickets.map(formatTicket);

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/tickets/:id
 * Fetch single ticket by id or ticketId
 */
export const getTicketById = async (req, res) => {
  try {
    const { id } = req.params;
    let ticket = null;

    if (id.startsWith("t") || id.startsWith("TICK-")) {
      ticket = await Ticket.findOne({ ticketId: id });
    }
    if (!ticket) {
      ticket = await Ticket.findById(id).catch(() => null);
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({ success: true, data: formatTicket(ticket) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/tickets
 * Create a new support ticket (from Client or Admin)
 */
export const createTicket = async (req, res) => {
  try {
    const { subject, priority, desc, client, createdBy } = req.body;

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        success: false,
        message: "Ticket subject is required",
      });
    }

    const validPriorities = ["low", "medium", "high"];
    const sanitizedPriority = validPriorities.includes(priority) ? priority : "medium";

    const customId = `t${Date.now().toString().slice(-4)}`;

    const newTicket = new Ticket({
      ticketId: customId,
      subject: subject.trim(),
      desc: desc ? desc.trim() : "",
      priority: sanitizedPriority,
      status: "open",
      client: client || "Bright Smiles Dental",
      createdBy: createdBy || "Jane Whitfield",
      response: "",
    });

    const saved = await newTicket.save();

    return res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: formatTicket(saved),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/tickets/:id/status
 * Update ticket status (open, pending, closed, resolved)
 */
export const updateTicketStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["open", "pending", "closed", "resolved"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    let ticket = await Ticket.findOne({ ticketId: id });
    if (!ticket) {
      ticket = await Ticket.findById(id).catch(() => null);
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    ticket.status = status;
    const updated = await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status}`,
      data: formatTicket(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/tickets/:id/reply
 * Admin responds to a ticket. Saves official response and updates status.
 */
export const addReply = async (req, res) => {
  try {
    const { id } = req.params;
    const responseText = (req.body.response || req.body.message || "").trim();
    const sender = req.body.sender || "MorlyIQ Support Specialist";
    const status = req.body.status || "closed";

    if (!responseText) {
      return res.status(400).json({
        success: false,
        message: "Response message cannot be empty",
      });
    }

    let ticket = await Ticket.findOne({ ticketId: id });
    if (!ticket) {
      ticket = await Ticket.findById(id).catch(() => null);
    }

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    // Save official response
    ticket.response = responseText;
    ticket.respondedAt = new Date();
    ticket.respondedBy = sender;
    ticket.status = status;

    // Also push to replies list for backward compatibility
    ticket.replies.push({
      sender,
      message: responseText,
      createdAt: new Date(),
    });

    const updated = await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Response sent to client successfully",
      data: formatTicket(updated),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/tickets/:id
 * Delete a ticket
 */
export const deleteTicket = async (req, res) => {
  try {
    const { id } = req.params;

    let deleted = await Ticket.findOneAndDelete({ ticketId: id });
    if (!deleted) {
      deleted = await Ticket.findByIdAndDelete(id).catch(() => null);
    }

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
