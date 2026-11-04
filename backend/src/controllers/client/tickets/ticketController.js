import { Ticket } from "../../../models/Ticket.js";
import { ok, created, invalid } from "../../../utils/client/apiResponse.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTicket(ticket, req) {
  const obj = ticket.toObject();
  const lastReply = obj.replies?.length ? obj.replies[obj.replies.length - 1] : null;
  const response = obj.response || lastReply?.message || "";
  const respondedAt = obj.respondedAt || lastReply?.createdAt || null;
  const respondedBy = obj.respondedBy || lastReply?.sender || "";
  return {
    ...obj,
    mine: String(obj.createdById || "") === String(req.user._id),
    id: obj.ticketId || obj._id.toString(),
    updated: timeAgo(obj.updatedAt || obj.createdAt) || "just now",
    response,
    respondedAt,
    respondedBy,
    respondedTimeAgo: timeAgo(respondedAt),
  };
}

// The practice the signed-in user belongs to — tickets are always scoped to it.
const practiceOf = (req) => req.user.tenantId.name;

// Owner and Manager (at the active clinic) oversee every ticket of the practice
const isLeadership = (req) => ["Owner", "Manager"].includes(req.clinicRole);

// The Owner is account-level ("*" membership), so they see every clinic's tickets at once, no clinic filter needed
const isOwner = (req) => req.user.memberships.some((m) => m.active && m.clinicId === "*" && m.role === "Owner");

// Who may see which tickets, always limited to the practice:
//   Owner                                -> every ticket of every clinic, whoever raised it
//   Manager (active clinic, X-Clinic-Id) -> every ticket of that clinic, whoever raised it (older tickets with no clinic included)
//   Front Desk / Billing / Dentist       -> their own tickets + system-wide issues raised by anyone
const visibilityFilter = (req) =>
  isOwner(req)
    ? {}
    : isLeadership(req)
    ? { $or: [{ clinicId: req.clinicId }, { clinicId: null }] }
    : { clinicId: req.clinicId, $or: [{ category: "system" }, { createdById: req.user._id }] };

// GET /api/client-panel/tickets — the tickets the signed-in role may see at the active clinic
export const getTickets = async (req, res) => {
  const { status, priority, search } = req.query;
  const filter = { client: practiceOf(req), ...visibilityFilter(req) };
  if (status && status !== "all") filter.status = status;
  if (priority && priority !== "all") filter.priority = priority;
  if (search) filter.subject = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };

  const tickets = await Ticket.find(filter).sort({ updatedAt: -1, createdAt: -1 });
  ok(res, "Tickets loaded", tickets.map((t) => formatTicket(t, req)));
};

// POST /api/client-panel/tickets — practice and author come from the login, not the request body
export const createTicket = async (req, res) => {
  const { subject, priority, desc } = req.body;
  if (!subject?.trim()) {
    return invalid(res, [{ field: "subject", message: "Ticket subject is required" }]);
  }
  const ticket = await Ticket.create({
    clinicId: req.clinicId,
    createdById: req.user._id,
    category: req.body.category === "system" ? "system" : "request",
    ticketId: `t${Date.now().toString().slice(-4)}`,
    subject: subject.trim(),
    desc: desc ? desc.trim() : "",
    priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
    status: "open",
    client: practiceOf(req),
    createdBy: req.user.name,
  });
  await notifyAdminSafely({
    category: "support",
    type: ticket.priority === "high" ? "error" : ticket.priority === "medium" ? "warn" : "info",
    title: ticket.priority === "high" ? "High-priority support ticket" : "New client support ticket",
    message: `${ticket.client}: ${ticket.subject}`,
    actionUrl: "/tickets",
    audienceRoles: ["Super Admin"],
    clientName: ticket.client,
    sourceType: "ticket",
    sourceId: String(ticket._id),
    dedupeKey: `ticket:${ticket._id}:created`,
  });
  created(res, "Support ticket created successfully", formatTicket(ticket, req));
};
