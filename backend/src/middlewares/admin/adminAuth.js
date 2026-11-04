import jwt from "jsonwebtoken";
import { AdminUser } from "../../models/admin/AdminUser.js";
import { AdminSession } from "../../models/admin/AdminSession.js";
import {
  getRoleForAdmin,
  permissionList,
  roleHasPermission,
} from "../../services/admin/roleService.js";

const jwtSecret = () => {
  const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("Admin authentication is not configured");
    error.status = 503;
    throw error;
  }
  return secret;
};

export const signAdminToken = (user, sessionId) =>
  jwt.sign(
    { sub: String(user._id), sid: String(sessionId), aud: "admin-panel", role: user.role },
    jwtSecret(),
    { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || "8h" }
  );

export const signAdminMfaToken = (user) =>
  jwt.sign(
    { sub: String(user._id), aud: "admin-panel-mfa" },
    jwtSecret(),
    { expiresIn: "5m" }
  );

export const verifyAdminMfaToken = (token) =>
  jwt.verify(token, jwtSecret(), { audience: "admin-panel-mfa" }).sub;

export const protectAdmin = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : null;
    if (!token) {
      return res.status(401).json({ success: false, code: "UNAUTHENTICATED", message: "Sign in is required" });
    }

    const payload = jwt.verify(token, jwtSecret(), { audience: "admin-panel" });
    const session = payload.sid
      ? await AdminSession.findOne({
        _id: payload.sid,
        userId: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      })
      : null;
    if (!session) {
      return res.status(401).json({ success: false, code: "SESSION_EXPIRED", message: "This Admin session has expired or was signed out" });
    }

    const user = await AdminUser.findById(payload.sub);
    if (!user || user.status !== "active") {
      return res.status(401).json({ success: false, code: "ACCOUNT_UNAVAILABLE", message: "This account is not available" });
    }
    if (user.passwordChangedAt && user.passwordChangedAt.getTime() > payload.iat * 1000) {
      return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Your password changed. Please sign in again." });
    }

    const role = await getRoleForAdmin(user);
    if (!role) {
      return res.status(403).json({ success: false, code: "ROLE_UNAVAILABLE", message: "Your assigned role is not available" });
    }
    req.adminUser = user;
    req.adminRole = role;
    req.adminPermissions = new Set(permissionList(role));
    req.adminSessionId = session.id;
    if (Date.now() - session.lastActiveAt.getTime() > 60_000) {
      session.lastActiveAt = new Date();
      session.save().catch(() => {});
    }
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, code: "INVALID_TOKEN", message: "Your session has expired. Please sign in again." });
    }
    next(error);
  }
};

export const requireAdminRoles = (...roles) => (req, res, next) => {
  if (!req.adminRole || !roles.includes(req.adminRole.roleName)) {
    return res.status(403).json({
      success: false,
      code: "ROLE_NOT_ALLOWED",
      message: "You do not have permission to access this Admin resource",
    });
  }
  next();
};

export const requireAdminPermission = (resource, action) => (req, res, next) => {
  if (!roleHasPermission(req.adminRole, resource, action)) {
    return res.status(403).json({
      success: false,
      code: "PERMISSION_DENIED",
      message: `Missing permission: ${resource}:${action}`,
    });
  }
  next();
};

export const requireAnyAdminPermission = (resource, ...actions) => (req, res, next) => {
  if (!actions.some((action) => roleHasPermission(req.adminRole, resource, action))) {
    return res.status(403).json({
      success: false,
      code: "PERMISSION_DENIED",
      message: `Missing one of: ${actions.map((action) => `${resource}:${action}`).join(", ")}`,
    });
  }
  next();
};
