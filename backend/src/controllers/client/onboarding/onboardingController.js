import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Client } from "../../../models/Client.js";
import { Plan } from "../../../models/admin/Plan.js";
import { ClientUser } from "../../../models/client/ClientUser.js";
import { ClientInvitation } from "../../../models/client/ClientInvitation.js";
import { ok, fail, invalid } from "../../../utils/client/apiResponse.js";
import { getStripe, recurringFromPeriod } from "../../../services/billing/stripeService.js";
import {
  invoiceForClient,
  syncCheckoutInvoice,
  upsertStripeInvoice,
} from "../../../services/billing/invoiceService.js";
import { BillingInvoice } from "../../../models/client/BillingInvoice.js";
import { hashInvitationToken, invitationFromToken, markCheckoutPaid } from "../../../services/client/onboardingService.js";
import { notifyAdminSafely } from "../../../services/admin/notificationService.js";

const appBaseUrl = () => String(process.env.CLIENT_APP_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

async function onboardingData(invitation) {
  const client = await Client.findById(invitation.clientId).lean();
  const [plan, invoice] = client ? await Promise.all([
    Plan.findOne({ key: client.planId }).lean(),
    BillingInvoice.findOne({ tenantId: client._id }).sort({ stripeCreatedAt: -1, createdAt: -1 }).lean(),
  ]) : [null, null];
  if (!client || !plan) return null;
  return {
    practice: { name: client.name, ownerName: client.ownerName, email: client.email },
    plan: {
      id: plan.key,
      name: plan.name,
      price: plan.price,
      currency: plan.currency || "USD",
      period: plan.period,
    },
    status: invitation.status,
    paymentStatus: client.billing?.paymentStatus || "pending",
    requiresPayment: !["paid", "completed"].includes(invitation.status),
    canCreatePassword: invitation.status === "paid",
    expiresAt: invitation.expiresAt,
    invoice: invoice ? invoiceForClient(invoice) : null,
  };
}

export const getOnboarding = async (req, res) => {
  const invitation = await invitationFromToken(req.params.token);
  if (!invitation) return fail(res, 404, "This invitation is invalid or has expired", { code: "INVITATION_EXPIRED" });
  const data = await onboardingData(invitation);
  if (!data) return fail(res, 404, "This client invitation is no longer available", { code: "INVITATION_NOT_FOUND" });
  return ok(res, "Onboarding details loaded", data);
};

export const createCheckout = async (req, res) => {
  const invitation = await invitationFromToken(req.params.token);
  if (!invitation) return fail(res, 404, "This invitation is invalid or has expired", { code: "INVITATION_EXPIRED" });
  if (["paid", "completed"].includes(invitation.status)) {
    return ok(res, "Payment is already complete", { paid: true });
  }

  const [client, plan] = await Promise.all([
    Client.findById(invitation.clientId),
    Client.findById(invitation.clientId).lean().then((row) => row && Plan.findOne({ key: row.planId })),
  ]);
  if (!client || !plan) return fail(res, 404, "Client or plan not found", { code: "ONBOARDING_UNAVAILABLE" });
  const recurring = recurringFromPeriod(plan.period);
  if (!recurring || !Number.isFinite(Number(plan.price)) || Number(plan.price) <= 0) {
    return fail(res, 422, "This plan is not configured for Stripe subscription checkout", { code: "PLAN_NOT_CHECKOUT_READY" });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return fail(res, 503, error.message, { code: error.code || "STRIPE_NOT_CONFIGURED" });
  }

  if (invitation.stripeCheckoutSessionId) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(invitation.stripeCheckoutSessionId);
      if (["paid", "no_payment_required"].includes(existing.payment_status)) {
        await markCheckoutPaid(existing);
        return ok(res, "Payment is complete", { paid: true });
      }
      if (existing.status === "open" && existing.url) {
        return ok(res, "Checkout session ready", { checkoutUrl: existing.url, sessionId: existing.id });
      }
    } catch {
      // Expired or unavailable sessions are replaced with a fresh Checkout Session below.
    }
  }

  const token = encodeURIComponent(req.params.token);
  const base = appBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    client_reference_id: String(client._id),
    customer_email: invitation.email,
    payment_method_types: ["card"],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: String(plan.currency || "USD").toLowerCase(),
        unit_amount: Math.round(Number(plan.price) * 100),
        recurring,
        product_data: {
          name: `MorlyIQ — ${plan.name}`,
          description: `${client.name} · ${plan.period} subscription`,
        },
      },
    }],
    metadata: { clientId: String(client._id), invitationId: String(invitation._id) },
    subscription_data: { metadata: { clientId: String(client._id), invitationId: String(invitation._id) } },
    success_url: `${base}/onboarding/${token}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/onboarding/${token}?checkout=cancelled`,
  });

  if (process.env.STRIPE_TEST_MODE_ONLY !== "false" && session.livemode) {
    await stripe.checkout.sessions.expire(session.id).catch(() => {});
    return fail(res, 503, "Only Stripe test-mode checkout is allowed in this environment", { code: "STRIPE_TEST_MODE_REQUIRED" });
  }

  invitation.status = "checkout_open";
  invitation.stripeCheckoutSessionId = session.id;
  await invitation.save();
  client.billing.paymentStatus = "pending";
  client.billing.stripeCheckoutSessionId = session.id;
  await client.save();

  return ok(res, "Checkout session ready", { checkoutUrl: session.url, sessionId: session.id });
};

export const confirmCheckout = async (req, res) => {
  const invitation = await invitationFromToken(req.params.token);
  if (!invitation) return fail(res, 404, "This invitation is invalid or has expired", { code: "INVITATION_EXPIRED" });
  const sessionId = String(req.body?.sessionId || "").trim();
  if (!sessionId || sessionId !== invitation.stripeCheckoutSessionId) {
    return fail(res, 400, "Checkout session does not match this invitation", { code: "CHECKOUT_SESSION_MISMATCH" });
  }

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return fail(res, 503, error.message, { code: error.code || "STRIPE_NOT_CONFIGURED" });
  }
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription.latest_invoice"],
  });
  if (String(session.client_reference_id || "") !== String(invitation.clientId)) {
    return fail(res, 400, "Checkout session does not belong to this client", { code: "CHECKOUT_SESSION_MISMATCH" });
  }
  if (!["paid", "no_payment_required"].includes(session.payment_status)) {
    return fail(res, 409, "Stripe has not confirmed payment yet", { code: "PAYMENT_NOT_CONFIRMED" });
  }
  await markCheckoutPaid(session);
  // Invoice syncing must not undo a payment that Stripe has already confirmed.
  // The signed invoice webhook retries reconciliation if the invoice is not ready yet.
  const invoice = await syncCheckoutInvoice(stripe, session, String(invitation.clientId)).catch(() => null);
  return ok(res, "Payment confirmed. Create your password to activate the account.", {
    paid: true,
    canCreatePassword: true,
    invoice: invoice ? invoiceForClient(invoice) : null,
  });
};

export const createOwnerPassword = async (req, res) => {
  const invitation = await invitationFromToken(req.params.token);
  if (!invitation) return fail(res, 404, "This invitation is invalid or has expired", { code: "INVITATION_EXPIRED" });
  if (invitation.status !== "paid") {
    return fail(res, 409, "Complete payment before creating your password", { code: "PAYMENT_REQUIRED" });
  }

  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");
  const errors = [];
  if (password.length < 8) errors.push({ field: "password", message: "Password must be at least 8 characters" });
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.push({ field: "password", message: "Use an uppercase letter, lowercase letter and number" });
  }
  if (password !== confirmPassword) errors.push({ field: "confirmPassword", message: "Passwords do not match" });
  if (errors.length) return invalid(res, errors);

  const owner = await ClientUser.findById(invitation.ownerUserId).select("+password");
  if (!owner) return fail(res, 404, "Owner account not found", { code: "OWNER_NOT_FOUND" });
  owner.password = await bcrypt.hash(password, 10);
  owner.passwordChangedAt = new Date();
  owner.status = "active";
  await owner.save();

  await Client.updateOne(
    { _id: invitation.clientId, "billing.paymentStatus": "paid" },
    { $set: { status: "active" } }
  );
  const invoice = await BillingInvoice.findOne({ tenantId: invitation.clientId })
    .sort({ stripeCreatedAt: -1, createdAt: -1 })
    .lean();

  invitation.status = "completed";
  invitation.completedAt = new Date();
  // Invalidate the emailed secret after it has done its job.
  invitation.tokenHash = hashInvitationToken(crypto.randomBytes(32).toString("base64url"));
  await invitation.save();

  return ok(res, "Your MorlyIQ account is active. Sign in with your new password.", {
    loginUrl: `${appBaseUrl()}/login`,
    email: owner.email,
    invoice: invoice ? invoiceForClient(invoice) : null,
  });
};

export const stripeWebhook = async (req, res) => {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) return fail(res, 503, "Stripe webhook secret is not configured", { code: "STRIPE_WEBHOOK_NOT_CONFIGURED" });

  let stripe;
  try {
    stripe = getStripe();
  } catch (error) {
    return fail(res, 503, error.message, { code: error.code || "STRIPE_NOT_CONFIGURED" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], secret);
  } catch (error) {
    return fail(res, 400, `Invalid Stripe webhook signature: ${error.message}`, { code: "INVALID_STRIPE_SIGNATURE" });
  }

  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    const invitation = await markCheckoutPaid(event.data.object);
    if (invitation) {
      await syncCheckoutInvoice(stripe, event.data.object, String(invitation.clientId)).catch(() => null);
    }
  }
  if (event.type === "checkout.session.async_payment_failed") {
    const invitation = await ClientInvitation.findOne({ stripeCheckoutSessionId: event.data.object.id });
    if (invitation) {
      await Client.updateOne({ _id: invitation.clientId }, { $set: { "billing.paymentStatus": "failed" } });
      const client = await Client.findById(invitation.clientId).select("name").lean();
      await notifyAdminSafely({
        category: "billing",
        type: "error",
        title: "Client checkout payment failed",
        message: `${client?.name || invitation.email} could not complete the Stripe payment.`,
        actionUrl: "/clients",
        audienceRoles: ["Super Admin"],
        clientName: client?.name || "",
        sourceType: "stripe_event",
        sourceId: event.id,
        dedupeKey: `stripe:${event.id}`,
      });
    }
  }
  if (["invoice.paid", "invoice.payment_succeeded"].includes(event.type)) {
    const invoice = await upsertStripeInvoice(event.data.object);
    if (invoice) {
      await Client.updateOne(
        { _id: invoice.tenantId },
        {
          $set: {
            "billing.paymentStatus": "paid",
            "billing.stripeCustomerId": invoice.stripeCustomerId,
            "billing.stripeSubscriptionId": invoice.stripeSubscriptionId,
            "billing.paidAt": invoice.paidAt || new Date(),
          },
        }
      );
    }
  }
  if (event.type === "invoice.payment_failed") {
    const invoice = await upsertStripeInvoice(event.data.object);
    if (invoice) {
      await Client.updateOne(
        { _id: invoice.tenantId },
        { $set: { "billing.paymentStatus": "failed", status: "past_due" } }
      );
      const client = await Client.findById(invoice.tenantId).select("name").lean();
      await notifyAdminSafely({
        category: "billing",
        type: "error",
        title: "Subscription payment failed",
        message: `${client?.name || "A client"} has a failed invoice payment and is now past due.`,
        actionUrl: "/clients",
        audienceRoles: ["Super Admin"],
        clientName: client?.name || "",
        sourceType: "stripe_event",
        sourceId: event.id,
        dedupeKey: `stripe:${event.id}`,
      });
    }
  }
  return res.status(200).json({ received: true });
};
