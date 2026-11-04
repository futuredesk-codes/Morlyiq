import { AdminSession } from "../../models/admin/AdminSession.js";

const SESSION_HOURS = 8;

const clientIp = (req) => String(req.ip || req.socket?.remoteAddress || "")
  .replace(/^::ffff:/, "")
  .replace(/^::1$/, "127.0.0.1");

export const createAdminSession = (user, req) => AdminSession.create({
  userId: user._id,
  ip: clientIp(req),
  userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
  expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000),
});

export const revokeAdminSession = (sessionId, userId) => AdminSession.updateOne(
  { _id: sessionId, userId, revokedAt: null },
  { $set: { revokedAt: new Date() } }
);
