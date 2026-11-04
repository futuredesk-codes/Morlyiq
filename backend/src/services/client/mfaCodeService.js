import crypto from "crypto";
import { sendMfaCode } from "./emailService.js";

// Email MFA: a 6-digit one-time code is emailed to the user. Only a hash is stored (on user.mfa.emailCode),
// the code is valid for 10 minutes, can be used once, and can be re-sent at most every 30 seconds.
const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;

const hash = (userId, code) =>
  crypto
    .createHash("sha256")
    .update(`${userId}:${String(code).trim()}:${process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET || "dev-only-change-me"}`)
    .digest("hex");

// Fields of user.mfa.emailCode are select:false — add this to queries that read or write the code
export const MFA_SELECT = "+mfa.emailCode.hash +mfa.emailCode.expiresAt +mfa.emailCode.sentAt";

/** "jane@gmail.com" -> "j***@gmail.com" (shown on screen so the user knows where to look) */
export const maskEmail = (email = "") => email.replace(/^(.).*(@.*)$/, "$1***$2");

/**
 * Creates a fresh code, saves its hash on the user and emails it.
 * Returns { sent: true } or { sent: false, reason, wait? } — `wait` = seconds until a resend is allowed.
 * `user` must be a Mongoose document (it is saved here).
 */
export async function issueEmailCode(user) {
  const last = user.mfa?.emailCode?.sentAt;
  if (last && Date.now() - last.getTime() < RESEND_SECONDS * 1000) {
    return { sent: false, wait: Math.ceil((RESEND_SECONDS * 1000 - (Date.now() - last.getTime())) / 1000), reason: "Please wait a moment before requesting another code" };
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const result = await sendMfaCode({ to: user.email, name: user.name, code, minutes: CODE_MINUTES });
  if (!result.sent) return { sent: false, reason: result.reason };

  user.mfa.emailCode = { hash: hash(user.id, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000), sentAt: new Date() };
  await user.save();
  return { sent: true };
}

/** Checks `code` against the emailed one. A correct code is consumed (one use). Caller must save the user. */
export function consumeEmailCode(user, code) {
  const saved = user.mfa?.emailCode;
  if (!saved?.hash || !saved.expiresAt || saved.expiresAt.getTime() < Date.now()) return false;
  const a = Buffer.from(hash(user.id, code));
  const b = Buffer.from(saved.hash);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  // Used up: clear it, and clear the resend cooldown too (it only exists to stop spamming UNUSED codes)
  if (ok) user.mfa.emailCode = { hash: null, expiresAt: null, sentAt: null };
  return ok;
}
