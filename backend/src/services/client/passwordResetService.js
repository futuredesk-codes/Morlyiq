import crypto from "crypto";
import { sendPasswordResetCode } from "./emailService.js";

// Forgot password: a 6-digit one-time code is emailed. Only a hash is stored (user.passwordReset),
// valid for 10 minutes, single use, and a new one can be requested at most every 30 seconds.
const CODE_MINUTES = 10;
const RESEND_SECONDS = 30;

// The code is bound to the user id and a server secret, so a leaked hash cannot be replayed elsewhere
const hash = (userId, code) =>
  crypto
    .createHash("sha256")
    .update(`reset:${userId}:${String(code).trim()}:${process.env.CLIENT_JWT_SECRET || process.env.JWT_SECRET || "dev-only-change-me"}`)
    .digest("hex");

// passwordReset.* is select:false — add this to queries that read or write the code
export const RESET_SELECT = "+passwordReset.hash +passwordReset.expiresAt +passwordReset.sentAt";

/** Creates a fresh code, saves its hash on the user and emails it. `user` must be a Mongoose document. */
export async function issueResetCode(user) {
  const last = user.passwordReset?.sentAt;
  if (last && Date.now() - last.getTime() < RESEND_SECONDS * 1000) return { sent: false, throttled: true };

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const result = await sendPasswordResetCode({ to: user.email, name: user.name, code, minutes: CODE_MINUTES });
  if (!result.sent) return { sent: false, reason: result.reason };

  user.passwordReset = { hash: hash(user.id, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000), sentAt: new Date() };
  await user.save();
  return { sent: true };
}

/** Checks `code`; a correct code is consumed (single use). Caller must save the user. */
export function consumeResetCode(user, code) {
  const saved = user.passwordReset;
  if (!saved?.hash || !saved.expiresAt || saved.expiresAt.getTime() < Date.now()) return false;
  const a = Buffer.from(hash(user.id, code));
  const b = Buffer.from(saved.hash);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (ok) user.passwordReset = { hash: null, expiresAt: null, sentAt: null };
  return ok;
}
