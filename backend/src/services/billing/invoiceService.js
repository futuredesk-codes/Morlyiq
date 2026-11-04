import { BillingInvoice } from "../../models/client/BillingInvoice.js";
import { Client } from "../../models/Client.js";
import { ClientInvitation } from "../../models/client/ClientInvitation.js";
import { stripeId } from "./stripeService.js";

const stripeDate = (seconds) => (
  Number.isFinite(Number(seconds)) && Number(seconds) > 0
    ? new Date(Number(seconds) * 1000)
    : null
);

const invoiceSubscriptionId = (invoice) => stripeId(
  invoice?.subscription
  || invoice?.parent?.subscription_details?.subscription
  || invoice?.subscription_details?.subscription
);

const invoiceMetadata = (invoice) => ({
  ...(invoice?.subscription_details?.metadata || {}),
  ...(invoice?.parent?.subscription_details?.metadata || {}),
  ...(invoice?.metadata || {}),
});

async function resolveTenantId(invoice, preferredClientId = "") {
  if (preferredClientId) return preferredClientId;

  const metadataClientId = invoiceMetadata(invoice).clientId;
  if (metadataClientId) return metadataClientId;

  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = stripeId(invoice?.customer);
  if (!subscriptionId && !customerId) return null;
  const invitation = await ClientInvitation.findOne({
    $or: [
      ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
      ...(customerId ? [{ stripeCustomerId: customerId }] : []),
    ],
  }).lean();
  if (invitation?.clientId) return invitation.clientId;

  const client = await Client.findOne({
    $or: [
      ...(subscriptionId ? [{ "billing.stripeSubscriptionId": subscriptionId }] : []),
      ...(customerId ? [{ "billing.stripeCustomerId": customerId }] : []),
    ],
  }).select("_id").lean();
  return client?._id || null;
}

export const invoiceForClient = (invoice) => ({
  id: invoice.number || invoice.stripeInvoiceId,
  stripeInvoiceId: invoice.stripeInvoiceId,
  number: invoice.number || "",
  status: invoice.status,
  currency: String(invoice.currency || "usd").toUpperCase(),
  subtotal: Number(invoice.subtotal || 0) / 100,
  amount: Number(invoice.total || 0) / 100,
  amountPaid: Number(invoice.amountPaid || 0) / 100,
  amountDue: Number(invoice.amountDue || 0) / 100,
  hostedInvoiceUrl: invoice.hostedInvoiceUrl || "",
  invoicePdf: invoice.invoicePdf || "",
  billingReason: invoice.billingReason || "",
  periodStart: invoice.periodStart,
  periodEnd: invoice.periodEnd,
  paidAt: invoice.paidAt,
  createdAt: invoice.stripeCreatedAt || invoice.createdAt,
});

export async function upsertStripeInvoice(invoice, { clientId = "" } = {}) {
  if (!invoice?.id) return null;
  const tenantId = await resolveTenantId(invoice, clientId);
  if (!tenantId) return null;

  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = stripeId(invoice.customer);
  const paidAt = stripeDate(invoice.status_transitions?.paid_at);
  const row = await BillingInvoice.findOneAndUpdate(
    { stripeInvoiceId: invoice.id },
    {
      $set: {
        tenantId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        number: invoice.number || "",
        status: invoice.status || (invoice.paid ? "paid" : "open"),
        currency: String(invoice.currency || "usd").toLowerCase(),
        subtotal: Number(invoice.subtotal || 0),
        total: Number(invoice.total || 0),
        amountPaid: Number(invoice.amount_paid || 0),
        amountDue: Number(invoice.amount_due || 0),
        hostedInvoiceUrl: invoice.hosted_invoice_url || "",
        invoicePdf: invoice.invoice_pdf || "",
        billingReason: invoice.billing_reason || "",
        periodStart: stripeDate(invoice.period_start),
        periodEnd: stripeDate(invoice.period_end),
        paidAt,
        stripeCreatedAt: stripeDate(invoice.created),
        livemode: Boolean(invoice.livemode),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return row;
}

export async function syncCheckoutInvoice(stripe, session, clientId = "") {
  const subscriptionId = stripeId(session?.subscription);
  if (!subscriptionId) return null;

  let subscription = typeof session.subscription === "object" ? session.subscription : null;
  if (!subscription || !subscription.latest_invoice) {
    subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
  }

  let invoice = subscription.latest_invoice;
  if (!invoice) return null;
  if (typeof invoice === "string") invoice = await stripe.invoices.retrieve(invoice);
  return upsertStripeInvoice(invoice, { clientId });
}
