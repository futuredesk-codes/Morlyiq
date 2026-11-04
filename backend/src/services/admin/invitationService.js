import crypto from "crypto";

export const ADMIN_INVITATION_DAYS = 7;
export const ADMIN_INVITATION_SELECT = "+invitation.tokenHash";

export const hashAdminInvitationToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

export const createAdminInvitation = () => {
  const token = crypto.randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashAdminInvitationToken(token),
    expiresAt: new Date(Date.now() + ADMIN_INVITATION_DAYS * 24 * 60 * 60 * 1000),
  };
};

export const adminInvitationUrl = (token) => {
  const configured = String(process.env.ADMIN_APP_URL || "http://localhost:5174").trim();
  const baseUrl = configured.replace(/\/login\/?$/i, "").replace(/\/$/, "");
  return `${baseUrl}/accept-invitation/${encodeURIComponent(token)}`;
};
