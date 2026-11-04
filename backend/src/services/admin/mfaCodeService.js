import crypto from "crypto";
import { sendMfaCode } from "../client/emailService.js";

const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;

const secret = () => process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || "dev-only-change-me";
const hash = (userId, code) => crypto
  .createHash("sha256")
  .update(`${userId}:${String(code).trim()}:${secret()}:admin-mfa`)
  .digest("hex");

export const ADMIN_MFA_SELECT = "+mfa.emailCode.hash +mfa.emailCode.expiresAt +mfa.emailCode.sentAt";
export const maskAdminEmail = (email = "") => email.replace(/^(.).*(@.*)$/, "$1***$2");

export async function issueAdminMfaCode(user) {
  const last = user.mfa?.emailCode?.sentAt;
  if (last && Date.now() - last.getTime() < RESEND_SECONDS * 1000) {
    return {
      sent: false,
      wait: Math.ceil((RESEND_SECONDS * 1000 - (Date.now() - last.getTime())) / 1000),
      reason: "Please wait before requesting another code",
    };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const result = await sendMfaCode({ to: user.email, name: user.name, code, minutes: CODE_MINUTES });
  if (!result.sent) return result;

  user.mfa.emailCode = {
    hash: hash(user.id, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
    sentAt: new Date(),
  };
  await user.save();
  return { sent: true };
}

export function consumeAdminMfaCode(user, code) {
  const saved = user.mfa?.emailCode;
  if (!saved?.hash || !saved.expiresAt || saved.expiresAt.getTime() < Date.now()) return false;
  const expected = Buffer.from(saved.hash);
  const received = Buffer.from(hash(user.id, code));
  const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);
  if (valid) user.mfa.emailCode = { hash: null, expiresAt: null, sentAt: null };
  return valid;
}
