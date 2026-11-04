import React from "react";
import { Download, RotateCcw, Receipt } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { useAdmin } from "../store/useAdmin.js";

export default function BillingPage() {
  const { invoices, setInvoices, push, logAudit } = useAdmin();

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);

  const totalOverdue = invoices
    .filter((i) => i.status === "overdue" || i.status === "failed")
    .reduce((s, i) => s + i.amount, 0);

  function retry(inv) {
    push(`Retrying payment for ${inv.client}...`);
    setTimeout(() => {
      setInvoices((prev) =>
        prev.map((x) => (x.id === inv.id ? { ...x, status: "paid" } : x))
      );
      logAudit("Payment retried — succeeded", inv.client, "info");
      push(`Payment succeeded for ${inv.client}`);
    }, 1200);
  }

  function exportCsv() {
    logAudit("Report exported", "invoices.csv", "info");
    push("Preparing export — invoices.csv will download shortly");
  }

  return (
    <div>
      <SectionHeader
        title="Billing"
        subtitle="Invoicing across all client tenants"
        action={
          <Btn icon={Download} variant="outline" onClick={exportCsv}>
            Export CSV
          </Btn>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5">
        <Card>
          <div
            style={{
              fontSize: 11.5,
              color: C.textMute,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Collected this month
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.text,
              marginTop: 8,
              fontFamily: "Inter, sans-serif",
            }}
          >
            ${totalPaid.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 11.5,
              color: C.textMute,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Overdue / failed
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.danger,
              marginTop: 8,
              fontFamily: "Inter, sans-serif",
            }}
          >
            ${totalOverdue.toLocaleString()}
          </div>
        </Card>
        <Card>
          <div
            style={{
              fontSize: 11.5,
              color: C.textMute,
              fontFamily: "Inter, sans-serif",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Invoices this month
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: C.text,
              marginTop: 8,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {invoices.length}
          </div>
        </Card>
      </div>

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[650px] grid grid-cols-[1fr_1.4fr_1fr_1fr_0.9fr_110px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Invoice</div>
          <div>Client</div>
          <div>Amount</div>
          <div>Date</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {invoices.length === 0 && (
          <EmptyState
            icon={Receipt}
            text="No invoices available currently."
          />
        )}

        {invoices.map((inv) => (
          <div
            key={inv.id}
            className="min-w-[650px] grid grid-cols-[1fr_1.4fr_1fr_1fr_0.9fr_110px] items-center p-[11px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                color: C.navy,
                fontWeight: 600,
              }}
            >
              #{inv.id.replace("inv", "")}
            </div>
            <div style={{ color: C.text }}>{inv.client}</div>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              ${inv.amount.toLocaleString()}
            </div>
            <div style={{ color: C.textMute }}>{inv.date}</div>
            <div>
              <StatusBadge status={inv.status} />
            </div>
            <div>
              {(inv.status === "overdue" || inv.status === "failed") && (
                <Btn
                  size="sm"
                  variant="outline"
                  icon={RotateCcw}
                  onClick={() => retry(inv)}
                >
                  Retry
                </Btn>
              )}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
