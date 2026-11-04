import { AuditLog } from "../../models/admin/AuditLog.js";
import { Client } from "../../models/Client.js";

export const recordAdminAudit = async ({
  user = null,
  roleName = "",
  actorEmail = "",
  actorName = "",
  clientName = "",
  action,
  target = "",
  level = "info",
  source = "admin_console",
  req,
}) => {
  const resolvedRole = roleName || user?.role || "Unknown";
  const requestedClient = String(clientName || "").trim();
  let client = requestedClient && requestedClient !== "—" && requestedClient !== "-"
    ? await Client.findOne({ name: requestedClient }).select("name").lean()
    : null;

  if (!client && user && resolvedRole !== "Super Admin" && user.client) {
    client = await Client.findOne({ name: user.client }).select("name").lean();
  }

  return AuditLog.create({
    actorId: user?._id || null,
    actorName: user?.name || actorName || actorEmail || "Unknown actor",
    actorEmail: user?.email || actorEmail || "unknown@local.invalid",
    actorRole: resolvedRole,
    clientId: client?._id || null,
    clientName: client?.name || "",
    action,
    target,
    level,
    source,
    ipAddress: req?.ip || req?.socket?.remoteAddress || "",
    userAgent: req?.get?.("user-agent") || "",
  });
};

export const recordAdminAuditSafely = async (entry) => {
  try {
    return await recordAdminAudit(entry);
  } catch (error) {
    console.error(`[Admin Audit] ${entry.action || "event"} could not be recorded: ${error.message}`);
    return null;
  }
};
