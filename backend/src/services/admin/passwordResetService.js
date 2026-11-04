import crypto from "crypto";
import { sendPasswordResetCode } from "../client/emailService.js";

const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;

const secret = () => process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

const hashCode = (userId, code) =>
  crypto
    .createHash("sha256")
    .update(`admin-reset:${userId}:${String(code).trim()}:${secret()}`)
    .digest("hex");

export const ADMIN_RESET_SELECT = "+passwordReset.hash +passwordReset.expiresAt +passwordReset.sentAt";

export async function issueAdminResetCode(user) {
  const lastSent = user.passwordReset?.sentAt;
  if (lastSent && Date.now() - lastSent.getTime() < RESEND_SECONDS * 1000) {
    return { sent: false, throttled: true };
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const result = await sendPasswordResetCode({
    to: user.email,
    name: user.name,
    code,
    minutes: CODE_MINUTES,
  });
  if (!result.sent) return result;

  user.passwordReset = {
    hash: hashCode(user.id, code),
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
    sentAt: new Date(),
  };
  await user.save();
  return { sent: true };
}

export function consumeAdminResetCode(user, code) {
  const saved = user.passwordReset;
  if (!saved?.hash || !saved.expiresAt || saved.expiresAt.getTime() < Date.now()) return false;

  const candidate = Buffer.from(hashCode(user.id, code));
  const stored = Buffer.from(saved.hash);
  const matches = candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  if (matches) user.passwordReset = { hash: null, expiresAt: null, sentAt: null };
  return matches;
}
