import jwt from "jsonwebtoken";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { fail } from "../../../utils/client/apiResponse.js";
import { ClientSession } from "../../../models/client/ClientSession.js";

const secret = () => process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET || "dev-only-change-me";

// `sid` ties the token to a ClientSession, so a device is signed out by revoking that session
export const signClientToken = (user, sessionId) =>
  jwt.sign({ sub: user.id, sid: String(sessionId), aud: "client-panel" }, secret(), {
    expiresIn: process.env.CLIENT_JWT_EXPIRES_IN || "8h",
  });

// Short-lived token proving the password step passed while the MFA code is still pending.
// Different audience, so it can never be used as a normal session token.
export const signMfaToken = (user) => jwt.sign({ sub: user.id, aud: "client-panel-mfa" }, secret(), { expiresIn: "5m" });
export const verifyMfaToken = (token) => jwt.verify(token, secret(), { audience: "client-panel-mfa" }).sub;


/** Verifies the Bearer token and its live session; attaches req.user (tenant in req.user.tenantId) and req.sessionId */
export const protectClient = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return fail(res, 401, "Authentication required", { code: "UNAUTHENTICATED" });
  try {
    const { sub, sid } = jwt.verify(token, secret(), { audience: "client-panel" });
    const session =
      sid &&
      (await ClientSession.findOne({ _id: sid, userId: sub, revokedAt: null, expiresAt: { $gt: new Date() } }).catch(() => null));
    if (!session) return fail(res, 401, "Session expired or signed out. Please sign in again.", { code: "SESSION_EXPIRED" });
    const user = await ClientUser.findById(sub).populate("tenantId");
    if (!user || user.status !== "active") return fail(res, 401, "Account unavailable", { code: "ACCOUNT_UNAVAILABLE" });
    if (!user.tenantId || ["suspended", "archived"].includes(user.tenantId.status)) {
      return fail(res, 403, "This practice account is not active", { code: "PRACTICE_INACTIVE" });
    }
    if (user.tenantId.status === "invited") {
      return fail(res, 403, "Finish client onboarding before accessing the workspace", { code: "ONBOARDING_INCOMPLETE" });
    }
    // Remember activity for the "Active sessions" list (at most once a minute)
    if (Date.now() - session.lastActiveAt.getTime() > 60_000) {
      session.lastActiveAt = new Date();
      session.save().catch(() => {});
    }
    req.user = user;
    req.sessionId = session.id;
    next();
  } catch {
    return fail(res, 401, "Invalid or expired token", { code: "INVALID_TOKEN" });
  }
};

/** Restricts a route to the given roles, judged by the user's role AT THE ACTIVE CLINIC
 *  (use after protectClient + scopeClinic) */
export const authorizeRoles = (...roles) => (req, res, next) =>
  roles.includes(req.clinicRole)
    ? next()
    : fail(res, 403, `Role "${req.clinicRole}" is not allowed to perform this action at this clinic`, { code: "ROLE_NOT_ALLOWED" });
