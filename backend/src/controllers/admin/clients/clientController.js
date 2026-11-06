import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Client } from "../../../models/Client.js";
import { Plan } from "../../../models/admin/Plan.js";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { ClientInvitation } from "../../../models/client/ClientInvitation.js";
import { sendClientOnboardingInvite } from "../../../services/admin/emailService.js";
import { createInvitationToken, invitationExpiry } from "../../../services/client/onboardingService.js";
import { getStripe } from "../../../services/billing/stripeService.js";
import { getPlatformSettings } from "../../../services/admin/platformSettingsService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const onboardingLink = (token) => {
  const base = String(process.env.CLIENT_APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/onboarding/${encodeURIComponent(token)}`;
};

export const getClients = async (req, res) => {
  const clients = await Client.find().sort({ createdAt: -1 });
  return res.status(200).json({ success: true, count: clients.length, data: clients });
};

export const createClient = async (req, res) => {
  if ((await getPlatformSettings()).allowSignups === false) {
    return res.status(403).json({ success: false, code: "SIGNUPS_DISABLED", message: "New client signups are disabled in Platform Settings" });
  }
  const name = String(req.body?.name || "").trim();
  const ownerName = String(req.body?.ownerName || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const planId = String(req.body?.planId || "").trim();
  const errors = [];
  if (!name) errors.push({ field: "name", message: "Practice name is required" });
  if (!ownerName) errors.push({ field: "ownerName", message: "Owner name is required" });
  if (!EMAIL_RE.test(email)) errors.push({ field: "email", message: "Enter a valid owner email address" });
  if (!planId) errors.push({ field: "planId", message: "Select a plan" });
  if (errors.length) {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Check the highlighted fields", errors });
  }

  const [plan, existingUser] = await Promise.all([
    Plan.findOne({ key: planId }),
    ClientUser.findOne({ email }).lean(),
  ]);
  if (!plan || plan.status !== "Active") {
    return res.status(422).json({ success: false, code: "PLAN_UNAVAILABLE", message: "Select an active plan" });
  }
  if (!Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) {
    return res.status(422).json({ success: false, code: "PLAN_PRICE_REQUIRED", message: "The selected plan needs a price greater than $0 before Stripe checkout can be used" });
  }
  if (existingUser) {
    return res.status(409).json({ success: false, code: "EMAIL_ALREADY_REGISTERED", message: "This email already belongs to a MorlyIQ client user" });
  }
  try {
    getStripe();
  } catch (error) {
    return res.status(503).json({ success: false, code: error.code || "STRIPE_NOT_CONFIGURED", message: error.message });
  }

  const clinics = Math.max(1, Math.min(Number(req.body.clinics) || 1, 100));
  const entitlements = Object.fromEntries((plan.features || []).map((key) => [key, true]));
  let saved;
  let owner;
  let invitation;
  try {
    saved = await Client.create({
      name,
      ownerName,
      email,
      clinics,
      planId: plan.key,
      status: "invited",
      mrr: Number(plan.price),
      users: 0,
      verifications: 0,
      entitlements,
      billing: { paymentStatus: "pending" },
    });

    const unusablePassword = `${crypto.randomBytes(32).toString("base64url")}aA1!`;
    owner = await ClientUser.create({
      tenantId: saved._id,
      name: ownerName,
      email,
      password: await bcrypt.hash(unusablePassword, 10),
      memberships: [{ clinicId: "*", role: "Owner", active: true }],
      status: "invited",
    });

    const { token, tokenHash } = createInvitationToken();
    invitation = await ClientInvitation.create({
      clientId: saved._id,
      ownerUserId: owner._id,
      email,
      tokenHash,
      expiresAt: invitationExpiry(),
      status: "invited",
    });

    const url = onboardingLink(token);
    const emailResult = await sendClientOnboardingInvite({
      to: email,
      ownerName,
      practiceName: name,
      planName: plan.name,
      onboardingUrl: url,
    });
    if (emailResult.sent) {
      invitation.emailSentAt = new Date();
      await invitation.save();
    }

    return res.status(201).json({
      success: true,
      message: emailResult.sent ? "Client invited by email" : "Client created; invitation email was not sent",
      data: {
        ...saved.toObject(),
        users: 1,
        invitation: {
          emailSent: emailResult.sent,
          emailError: emailResult.reason || null,
          onboardingUrl: url,
          expiresAt: invitation.expiresAt,
        },
      },
    });
  } catch (error) {
    if (invitation?._id) await ClientInvitation.deleteOne({ _id: invitation._id }).catch(() => {});
    if (owner?._id) await ClientUser.deleteOne({ _id: owner._id }).catch(() => {});
    if (saved?._id) await Client.deleteOne({ _id: saved._id }).catch(() => {});
    throw error;
  }
};

export const updateClient = async (req, res) => {
  const allowed = ["name", "clinics", "planId", "status", "mrr", "users", "verifications", "entitlements"];
  const changes = Object.fromEntries(
    allowed.filter((key) => req.body?.[key] !== undefined).map((key) => [key, req.body[key]])
  );
  if (changes.name !== undefined) changes.name = String(changes.name).trim();
  if (changes.name === "") {
    return res.status(422).json({ success: false, code: "VALIDATION_ERROR", message: "Client name is required" });
  }
  if (changes.status === "trial") {
    const existing = await Client.findById(req.params.id).select("status trialEndsAt").lean();
    if (existing && (existing.status !== "trial" || !existing.trialEndsAt)) {
      const settings = await getPlatformSettings();
      changes.trialStartedAt = new Date();
      changes.trialEndsAt = new Date(changes.trialStartedAt.getTime() + (settings.trialLengthDays ?? 14) * 86400000);
    }
  }

  const client = await Client.findByIdAndUpdate(req.params.id, changes, {
    new: true,
    runValidators: true,
  });
  if (!client) {
    return res.status(404).json({ success: false, code: "CLIENT_NOT_FOUND", message: "Client not found" });
  }
  return res.status(200).json({ success: true, message: "Client updated", data: client });
};
