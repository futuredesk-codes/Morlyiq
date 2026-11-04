import { ClientSession } from "../../models/client/ClientSession.js";

const SESSION_HOURS = 8; // keep in step with CLIENT_JWT_EXPIRES_IN

/** "Chrome · Windows" from a User-Agent string */
export const describeDevice = (ua = "") => {
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} · ${os}`;
};

const clientIp = (req) =>
  String(req.ip || req.socket?.remoteAddress || "")
    .replace(/^::ffff:/, "")
    .replace(/^::1$/, "127.0.0.1");

export const createSession = (user, req) =>
  ClientSession.create({
    userId: user._id,
    tenantId: user.tenantId?._id || user.tenantId,
    device: describeDevice(req.headers["user-agent"]),
    userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ip: clientIp(req),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000),
  });

/** Signs out every session of the user, optionally keeping one. */
export const revokeSessions = (userId, exceptSessionId = null) =>
  ClientSession.updateMany(
    { userId, revokedAt: null, ...(exceptSessionId ? { _id: { $ne: exceptSessionId } } : {}) },
    { revokedAt: new Date() }
  );
