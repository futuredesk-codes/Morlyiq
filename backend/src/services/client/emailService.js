import nodemailer from "nodemailer";

// SMTP settings come from .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM).
// Returns null when SMTP is not configured, so callers can fall back instead of failing.
let transporter;
const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  transporter ||= nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true", // true for 465, false for 587 (STARTTLS)
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
};

/** True when SMTP is set up — MFA needs it, because the login code is sent by email. */
export const isEmailConfigured = () => Boolean(process.env.SMTP_HOST);

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/**
 * Sends the staff invitation. `temporaryPassword` is null when the person already had an account
 * (they were only added to another clinic) — then the email just tells them to sign in as usual.
 * Resolves { sent: true } or { sent: false, reason } — never throws, so an email problem
 * does not undo the invitation.
 */
export async function sendStaffInvite({ to, name, role, clinicName, practiceName, invitedBy, temporaryPassword }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server (SMTP settings missing)" };

  const loginUrl = process.env.CLIENT_APP_URL || "http://localhost:5173/login";
  const credentials = temporaryPassword
    ? { text: `\nEmail: ${to}\nTemporary password: ${temporaryPassword}\n`, html: `<table style="margin:14px 0;font-size:14px"><tr><td style="color:#5E6C87;padding:3px 14px 3px 0">Email</td><td><b>${esc(to)}</b></td></tr><tr><td style="color:#5E6C87;padding:3px 14px 3px 0">Temporary password</td><td><b style="font-family:monospace">${esc(temporaryPassword)}</b></td></tr></table>` }
    : { text: "\nSign in with your existing MorlyIQ email and password.\n", html: `<p style="font-size:14px;color:#5E6C87">Sign in with your existing MorlyIQ email and password.</p>` };

  const subject = `${invitedBy} invited you to ${clinicName} on MorlyIQ`;
  const text = `Hi ${name},\n\n${invitedBy} added you to ${clinicName} (${practiceName}) as ${role}.\n${credentials.text}\nSign in: ${loginUrl}\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">MorlyIQ</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p style="font-size:15px;margin-top:0">Hi ${esc(name)},</p>
      <p style="font-size:14px"><b>${esc(invitedBy)}</b> added you to <b>${esc(clinicName)}</b> (${esc(practiceName)}) as <b>${esc(role)}</b>.</p>
      ${credentials.html}
      <p><a href="${esc(loginUrl)}" style="display:inline-block;background:#0B3B8C;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px">Sign in to MorlyIQ</a></p>
    </div></div>`;

  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[Email] Invite to ${to} failed: ${err.message}`);
    return { sent: false, reason: "The email could not be sent" };
  }
}

/**
 * Sends a one-time MFA code. Resolves { sent: true } or { sent: false, reason } (never throws).
 */
export async function sendMfaCode({ to, name, code, minutes }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server (SMTP settings missing)" };

  const what = "sign in to MorlyIQ";
  const text = `Hi ${name},\n\nYour MorlyIQ verification code to ${what} is:\n\n    ${code}\n\nIt expires in ${minutes} minutes and can be used once. If you did not request it, change your password.\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">MorlyIQ</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p style="font-size:15px;margin-top:0">Hi ${esc(name)},</p>
      <p style="font-size:14px">Your verification code to ${esc(what)}:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:monospace;background:#F4F7FD;border-radius:10px;padding:14px 0;text-align:center;margin:14px 0">${esc(code)}</p>
      <p style="font-size:12.5px;color:#5E6C87">Expires in ${minutes} minutes and can be used once. If you didn't request this, change your password.</p>
    </div></div>`;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: `${code} is your MorlyIQ verification code`, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[Email] MFA code to ${to} failed: ${err.message}`);
    return { sent: false, reason: "The verification email could not be sent" };
  }
}

/**
 * Sends the password-reset code. Resolves { sent: true } or { sent: false, reason } (never throws).
 */
export async function sendPasswordResetCode({ to, name, code, minutes }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server (SMTP settings missing)" };

  const text = `Hi ${name},\n\nUse this code to reset your MorlyIQ password:\n\n    ${code}\n\nIt expires in ${minutes} minutes and can be used once. If you did not ask to reset your password, you can ignore this email — your password has not been changed.\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">MorlyIQ</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p style="font-size:15px;margin-top:0">Hi ${esc(name)},</p>
      <p style="font-size:14px">Use this code to reset your password:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:monospace;background:#F4F7FD;border-radius:10px;padding:14px 0;text-align:center;margin:14px 0">${esc(code)}</p>
      <p style="font-size:12.5px;color:#5E6C87">Expires in ${minutes} minutes and can be used once. If you didn't ask to reset your password, ignore this email — your password has not been changed.</p>
    </div></div>`;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: `${code} is your MorlyIQ password reset code`, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[Email] Password reset code to ${to} failed: ${err.message}`);
    return { sent: false, reason: "The email could not be sent" };
  }
}

/** Generic role-relevant Client Panel notification email. In-app creation never
 * fails when SMTP delivery is unavailable or rejected. */
export async function sendClientNotificationEmail({ to, name, title, message, actionUrl }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server (SMTP settings missing)" };

  const configured = String(process.env.CLIENT_APP_URL || "http://localhost:5173").trim();
  const baseUrl = configured.replace(/\/login\/?$/i, "").replace(/\/$/, "");
  const targetUrl = actionUrl ? `${baseUrl}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}` : `${baseUrl}/notifications`;
  const text = `Hi ${name},\n\n${title}\n${message}\n\nOpen MorlyIQ: ${targetUrl}\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">MorlyIQ notification</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p style="font-size:15px;margin-top:0">Hi ${esc(name)},</p>
      <p style="font-size:15px;font-weight:700;margin-bottom:6px">${esc(title)}</p>
      <p style="font-size:14px;color:#5E6C87;line-height:1.55">${esc(message)}</p>
      <p><a href="${esc(targetUrl)}" style="display:inline-block;background:#0B3B8C;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700;font-size:14px">Open MorlyIQ</a></p>
    </div></div>`;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: title, text, html });
    return { sent: true };
  } catch (err) {
    console.error(`[Email] Notification to ${to} failed: ${err.message}`);
    return { sent: false, reason: "The notification email could not be sent" };
  }
}
