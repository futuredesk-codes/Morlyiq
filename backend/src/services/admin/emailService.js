import nodemailer from "nodemailer";

let transporter;
const getTransporter = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST) return null;
  transporter ||= nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true",
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
  return transporter;
};

const escapeHtml = (value = "") =>
  String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

export async function sendAdminLeadReminder({ to, name, practiceName, title, dueAt, type, actionPath, messageId }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "SMTP is not configured" };
  const configured = String(process.env.ADMIN_APP_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5174")).trim();
  let target;
  try {
    const base = new URL(configured);
    if (!["http:", "https:"].includes(base.protocol)) throw new Error("Invalid protocol");
    base.pathname = base.pathname.replace(/\/login\/?$/i, "").replace(/\/$/, "") + "/leads";
    base.search = new URLSearchParams(actionPath.split("?")[1] || "").toString();
    base.hash = "";
    target = base.toString();
  } catch { return { sent: false, reason: "ADMIN_APP_URL is not configured correctly" }; }
  const label = type === "followup" ? "Follow-up" : "Task";
  const due = new Date(dueAt).toISOString().replace("T", " ").replace(".000Z", " UTC");
  const text = `Hi ${name},\n\nYour ${label.toLowerCase()} is due.\nLead: ${practiceName}\nAction: ${title}\nDue: ${due}\n\nOpen lead: ${target}\n\nMorlyIQ Admin`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;color:#0F1B33"><h2>${label} reminder</h2><p>Hi ${escapeHtml(name)},</p><p>Your ${label.toLowerCase()} is due.</p><p><b>Lead:</b> ${escapeHtml(practiceName)}<br><b>Action:</b> ${escapeHtml(title)}<br><b>Due:</b> ${escapeHtml(due)}</p><p><a href="${escapeHtml(target)}">Open lead in MorlyIQ</a></p></div>`;
  try {
    await transport.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject: `${label} reminder: ${practiceName}`, text, html, messageId });
    return { sent: true };
  } catch {
    return { sent: false, reason: "SMTP delivery failed" };
  }
}

export async function sendAdminInvite({ to, name, role, client, invitationUrl, expiresInDays, invitedBy }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server" };

  const text = `Hi ${name},\n\n${invitedBy} invited you to MorlyIQ Admin as ${role}.\nTenant: ${client || "Platform"}\nEmail: ${to}\n\nCreate your password and accept the invitation: ${invitationUrl}\n\nThis secure link can be used once and expires in ${expiresInDays} days.\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">MorlyIQ Admin</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p>Hi ${escapeHtml(name)},</p>
      <p><b>${escapeHtml(invitedBy)}</b> invited you as <b>${escapeHtml(role)}</b>.</p>
      <p style="font-size:14px;color:#5E6C87">Tenant: ${escapeHtml(client || "Platform")}</p>
      <table style="margin:14px 0;font-size:14px"><tr><td style="padding-right:14px;color:#5E6C87">Email</td><td><b>${escapeHtml(to)}</b></td></tr><tr><td style="padding-right:14px;color:#5E6C87">Role</td><td><b>${escapeHtml(role)}</b></td></tr></table>
      <p><a href="${escapeHtml(invitationUrl)}" style="display:inline-block;background:#0B3B8C;color:#fff;text-decoration:none;padding:10px 20px;border-radius:9px;font-weight:700">Create password &amp; accept invitation</a></p>
      <p style="font-size:12px;color:#8C97AE">This secure link can be used once and expires in ${escapeHtml(expiresInDays)} days. Your assigned tenant, role and permissions will remain unchanged.</p>
    </div></div>`;

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: "You have been invited to MorlyIQ Admin",
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error(`[Admin Email] Invite to ${to} failed: ${error.message}`);
    return { sent: false, reason: "The invitation email could not be sent" };
  }
}

export async function sendClientOnboardingInvite({ to, ownerName, practiceName, planName, onboardingUrl }) {
  const transport = getTransporter();
  if (!transport) return { sent: false, reason: "Email is not configured on the server" };

  const text = `Hi ${ownerName},\n\nYou have been invited to set up ${practiceName} on MorlyIQ.\nPlan: ${planName}\n\nComplete secure payment and create your password: ${onboardingUrl}\n\nThis link expires in 7 days.\n\n— MorlyIQ`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:auto;color:#0F1B33">
    <div style="background:#0B3B8C;color:#fff;padding:16px 22px;border-radius:12px 12px 0 0;font-size:17px;font-weight:700">Welcome to MorlyIQ</div>
    <div style="border:1px solid #DFE6F5;border-top:0;padding:22px;border-radius:0 0 12px 12px">
      <p>Hi ${escapeHtml(ownerName)},</p>
      <p>You have been invited to set up <b>${escapeHtml(practiceName)}</b> on MorlyIQ.</p>
      <p style="font-size:14px;color:#5E6C87">Selected plan: <b>${escapeHtml(planName)}</b></p>
      <p style="margin:20px 0"><a href="${escapeHtml(onboardingUrl)}" style="display:inline-block;background:#0B3B8C;color:#fff;text-decoration:none;padding:11px 20px;border-radius:9px;font-weight:700">Continue to secure checkout</a></p>
      <p style="font-size:12px;color:#8C97AE">Stripe securely handles payment details. After payment, you will create your MorlyIQ password. This invitation expires in 7 days.</p>
    </div></div>`;

  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: `Set up ${practiceName} on MorlyIQ`,
      text,
      html,
    });
    return { sent: true };
  } catch (error) {
    console.error(`[Admin Email] Client onboarding invite to ${to} failed: ${error.message}`);
    return { sent: false, reason: "The invitation email could not be sent" };
  }
}
