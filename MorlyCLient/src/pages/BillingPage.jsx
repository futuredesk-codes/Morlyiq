import React, { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Badge, StatusBadge } from "../components/common/Badge";
import { Btn } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { SectionHeader } from "../components/common/Feedback";
import { Modal } from "../components/common/Modal";
import { fetchSubscriptionApi } from "../services/billingService";
import { useApp } from "../store/useApp";

const statusTone = (status) => ({
  active: "success",
  trial: "blue",
  past_due: "warn",
  suspended: "danger",
}[status] || "neutral");

const statusLabel = (status) => String(status || "unknown")
  .replaceAll("_", " ")
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatAmount = (amount, currency) => {
  if (amount === null || amount === undefined) return "Custom pricing";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(amount);
};

const billingCadence = (period) => {
  const match = String(period || "").match(/^(\d+)\s+(.+)$/);
  if (!match) return period ? `billed ${period}` : "billing period not configured";
  const amount = Number(match[1]);
  const unit = match[2].replace(/s$/, "");
  if (amount === 1) return `billed ${unit}ly`;
  return `billed every ${amount} ${unit}s`;
};

export default function BillingPage() {
  const { clinicId, invoices: dummyInvoices, push } = useApp();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [changingPlan, setChangingPlan] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchSubscriptionApi(clinicId)
      .then((data) => active && setSubscription(data))
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
        push(requestError.message, "danger");
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [clinicId, push]);

  const renewalLabel = useMemo(() => {
    const value = subscription?.renewal?.date;
    if (!value) return "renewal date not configured";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "renewal date not configured";
    const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${subscription.renewal.estimated ? "estimated renewal" : "renews"} ${formatted}`;
  }, [subscription]);

  const displayedInvoices = subscription?.invoices?.length
    ? subscription.invoices
    : (dummyInvoices || []);

  const invoicePeriod = (invoice) => {
    if (!invoice.periodStart || !invoice.periodEnd) return invoice.period || "â€”";
    const start = new Date(invoice.periodStart);
    const end = new Date(invoice.periodEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return invoice.period || "â€”";
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} â€“ ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  };

  function downloadInvoice(invoice) {
    const target = invoice.invoicePdf || invoice.hostedInvoiceUrl;
    if (target) {
      window.open(target, "_blank", "noopener,noreferrer");
      return;
    }
    push(`${invoice.id}.pdf downloaded`);
  }

  return (
    <div>
      <SectionHeader
        title="Billing & Subscription"
        subtitle="Your MorlyIQ plan and usage"
      />

      <Card>
        {loading ? (
          <div className="py-7 text-center font-sans text-[13px] text-textMute">Loading subscription...</div>
        ) : error || !subscription ? (
          <div className="py-7 text-center font-sans text-[13px] text-brand-danger">{error || "Subscription unavailable"}</div>
        ) : (
          <>
            <div className="flex justify-between items-start flex-wrap gap-3.5">
              <div>
                <Badge text={statusLabel(subscription.status)} tone={statusTone(subscription.status)} />
                <div className="font-sans text-[19px] font-extrabold text-brand-text mt-2">
                  {subscription.plan.name}
                </div>
                <div className="font-sans text-[13px] text-textMute mt-1">
                  {formatAmount(subscription.plan.amount, subscription.plan.currency)}
                  {subscription.plan.amount !== null ? ` / ${subscription.plan.amountPeriod}` : ""}
                  {` · ${billingCadence(subscription.plan.billingPeriod)} · ${renewalLabel}`}
                </div>
              </div>
              <Btn variant="outline" onClick={() => setChangingPlan(true)}>Change plan</Btn>
            </div>

            <div className="mt-[18px] pt-4 border-t border-brand-border">
              <div className="flex justify-between font-sans text-[12.5px] text-textMute mb-1.5">
                <span>Verifications used</span>
                <span>
                  {subscription.usage.verificationsUsed.toLocaleString()} / {subscription.usage.limit === null ? "Unlimited" : subscription.usage.limit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-blueSoft2 rounded-[5px] overflow-hidden">
                <div
                  className="h-full bg-brand-blue rounded-full transition-all duration-300"
                  style={{ width: `${subscription.usage.percent ?? 0}%` }}
                />
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="font-sans text-[16px] font-bold text-brand-text mt-5 mb-3">Invoice history</div>
      <Card noPad className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_0.9fr_110px] px-4 py-[11px] bg-[#F4F7FD] text-[11px] font-bold text-textMute uppercase font-sans">
              <div>Invoice</div>
              <div>Period</div>
              <div>Amount</div>
              <div>Status</div>
              <div>Actions</div>
            </div>
            {displayedInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="grid grid-cols-[1fr_1fr_1fr_0.9fr_110px] items-center px-4 py-[11px] border-t border-brand-border font-sans text-[13px] hover:bg-slate-50/70 transition-colors"
              >
                <div className="font-mono text-navy font-semibold">#{String(invoice.number || invoice.id).replace("inv", "")}</div>
                <div className="text-textMute">{invoicePeriod(invoice)}</div>
                <div className="font-mono">{formatAmount(invoice.amount, invoice.currency || "USD")}</div>
                <div><StatusBadge status={invoice.status} /></div>
                <div>
                  <Btn size="sm" variant="outline" icon={Download} onClick={() => downloadInvoice(invoice)}>PDF</Btn>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {changingPlan && (
        <Modal
          title="Change plan"
          onClose={() => setChangingPlan(false)}
          footer={<Btn variant="outline" onClick={() => setChangingPlan(false)}>Close</Btn>}
        >
          <div className="font-sans text-[13.5px] text-textMute leading-[1.6]">
            Contact your MorlyIQ account manager to change the practice plan or billing cycle. The current subscription remains active until a change is confirmed.
          </div>
        </Modal>
      )}
    </div>
  );
}
