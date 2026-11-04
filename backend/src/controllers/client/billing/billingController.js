import { Plan } from "../../../models/admin/Plan.js";
import { BillingInvoice } from "../../../models/client/BillingInvoice.js";
import { ok, fail } from "../../../utils/client/apiResponse.js";
import { invoiceForClient } from "../../../services/billing/invoiceService.js";

const nextCycleDate = (anchorValue, period) => {
  const match = String(period || "").trim().match(/^(\d+)\s+(day|month|year)s?$/i);
  const anchor = new Date(anchorValue);
  if (!match || Number.isNaN(anchor.getTime())) return null;
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const next = new Date(anchor);
  const now = new Date();
  let guard = 0;
  while (next <= now && guard < 240) {
    if (unit === "day") next.setUTCDate(next.getUTCDate() + amount);
    if (unit === "month") next.setUTCMonth(next.getUTCMonth() + amount);
    if (unit === "year") next.setUTCFullYear(next.getUTCFullYear() + amount);
    guard += 1;
  }
  return guard >= 240 ? null : next;
};

// GET /api/client-panel/billing/subscription
export const getSubscription = async (req, res) => {
  const client = req.user.tenantId;
  const [plan, invoices] = await Promise.all([
    Plan.findOne({ key: client.planId }).lean(),
    BillingInvoice.find({ tenantId: client._id })
      .sort({ stripeCreatedAt: -1, createdAt: -1 })
      .limit(24)
      .lean(),
  ]);
  if (!plan) {
    return fail(res, 404, "The plan assigned to this practice could not be found", {
      code: "PLAN_NOT_FOUND",
    });
  }

  const usesClientMrr = Number(client.mrr) > 0;
  const usageLimit = plan.usageLimit ?? null;
  const verificationsUsed = Math.max(Number(client.verifications) || 0, 0);
  // Paid subscriptions renew from the first confirmed payment, not from the
  // date the Super Admin created the invitation record.
  const renewal = nextCycleDate(client.billing?.paidAt || client.createdAt, plan.period);

  ok(res, "Subscription loaded", {
    client: { id: client.id, name: client.name },
    status: client.status,
    plan: {
      id: plan.key,
      name: plan.name,
      currency: plan.currency || "USD",
      amount: usesClientMrr ? Number(client.mrr) : plan.price,
      amountPeriod: usesClientMrr ? "month" : plan.period,
      billingPeriod: plan.period,
      usageLimit,
    },
    usage: {
      verificationsUsed,
      limit: usageLimit,
      percent: usageLimit && usageLimit > 0
        ? Math.min((verificationsUsed / usageLimit) * 100, 100)
        : null,
    },
    renewal: {
      date: renewal,
      estimated: Boolean(renewal),
    },
    invoices: invoices.map(invoiceForClient),
  });
};
