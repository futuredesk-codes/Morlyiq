import mongoose from "mongoose";
import { AuditLog, AUDIT_LEVELS } from "../../../models/admin/AuditLog.js";
import { Client } from "../../../models/Client.js";
import { recordAdminAudit } from "../../../services/admin/auditService.js";

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serialize = (log) => ({
  id: String(log._id),
  timestamp: log.createdAt,
  actor: {
    id: log.actorId ? String(log.actorId) : null,
    name: log.actorName,
    email: log.actorEmail,
    role: log.actorRole,
  },
  client: log.clientId
    ? { id: String(log.clientId), name: log.clientName || "Unknown client" }
    : null,
  action: log.action,
  target: log.target,
  level: log.level,
  source: log.source,
});

export const createAuditLog = async (req, res) => {
  const action = String(req.body?.action || "").trim();
  const target = String(req.body?.target || "").trim();
  const level = String(req.body?.level || "info").toLowerCase();
  const requestedClient = String(req.body?.client || "").trim();

  if (!action || !AUDIT_LEVELS.includes(level)) {
    return res.status(422).json({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Provide a valid audit action and level",
    });
  }

  const log = await recordAdminAudit({
    user: req.adminUser,
    roleName: req.adminRole.roleName,
    clientName: requestedClient,
    action,
    target,
    level,
    req,
  });

  return res.status(201).json({ success: true, message: "Audit event recorded", data: serialize(log) });
};

export const getAuditLogs = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const query = {};

  if (req.query.level && req.query.level !== "all") {
    if (!AUDIT_LEVELS.includes(req.query.level)) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid audit level" });
    }
    query.level = req.query.level;
  }
  if (req.query.clientId && req.query.clientId !== "all") {
    if (!mongoose.Types.ObjectId.isValid(req.query.clientId)) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid client filter" });
    }
    query.clientId = req.query.clientId;
  }
  if (req.query.actorId && req.query.actorId !== "all") {
    if (!mongoose.Types.ObjectId.isValid(req.query.actorId)) {
      return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid actor filter" });
    }
    query.actorId = req.query.actorId;
  }
  const search = String(req.query.search || "").trim();
  if (search) {
    const expression = new RegExp(escapeRegex(search), "i");
    query.$or = [
      { action: expression },
      { target: expression },
      { actorName: expression },
      { actorEmail: expression },
      { clientName: expression },
    ];
  }

  const [logs, total, clients, actors] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(query),
    Client.find({ status: { $ne: "archived" } }).select("name").sort({ name: 1 }).lean(),
    AuditLog.aggregate([
      { $match: { actorId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$actorId", name: { $first: "$actorName" }, email: { $first: "$actorEmail" }, role: { $first: "$actorRole" } } },
      { $sort: { name: 1 } },
    ]),
  ]);

  return res.status(200).json({
    success: true,
    count: logs.length,
    data: {
      logs: logs.map(serialize),
      filters: {
        clients: clients.map((client) => ({ id: String(client._id), name: client.name })),
        actors: actors.map((actor) => ({ id: String(actor._id), name: actor.name, email: actor.email, role: actor.role })),
        levels: AUDIT_LEVELS,
      },
      pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
    },
  });
};
