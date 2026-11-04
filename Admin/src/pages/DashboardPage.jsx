import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Building2,
  Activity,
  LifeBuoy,
  AlertTriangle,
  PhoneCall,
  ShieldCheck,
} from "lucide-react";
import { C } from "../constants/theme.js";
import { LEAD_STATUSES, STATUS_TONE } from "../constants/navigation.js";
import { Card, SectionHeader, MiniBar } from "../components/common/Card.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { fetchAdminDashboardStatsApi } from "../services/dashboardService.js";

const EMPTY_DASHBOARD = {
  kpis: {
    monthlyRecurringRevenue: 0,
    activeClients: 0,
    trialClients: 0,
    verificationsThisMonth: 0,
    openTickets: 0,
    overdueInvoices: 0,
    insurerIssues: 0,
    series: { revenue: [], activeClients: [], verifications: [], tickets: [] },
  },
  plans: [],
  leadFunnel: [],
  recentActivity: [],
};

const ACTIVITY_ICONS = {
  client: Building2,
  warning: AlertTriangle,
  lead: PhoneCall,
  insurer: ShieldCheck,
  ticket: LifeBuoy,
};

export default function DashboardPage() {
  const { push } = useAdmin();
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);

  useEffect(() => {
    let active = true;
    fetchAdminDashboardStatsApi()
      .then((data) => {
        if (active) {
          setDashboard({
            ...EMPTY_DASHBOARD,
            ...data,
            kpis: { ...EMPTY_DASHBOARD.kpis, ...data.kpis },
          });
        }
      })
      .catch((error) => {
        if (active) push(`Could not load dashboard: ${error.message}`, "danger");
      });
    return () => { active = false; };
  }, [push]);

  const { kpis: dashboardKpis, plans, recentActivity } = dashboard;
  const activeClients = dashboardKpis.activeClients;
  const trialClients = dashboardKpis.trialClients;
  const mrr = dashboardKpis.monthlyRecurringRevenue;
  const totalVerifications = dashboardKpis.verificationsThisMonth;
  const openTickets = dashboardKpis.openTickets;
  const overdueInvoices = dashboardKpis.overdueInvoices;
  const insurerIssues = dashboardKpis.insurerIssues;

  const kpis = [
    {
      label: "Monthly recurring revenue",
      value: `$${mrr.toLocaleString()}`,
      trend: "Current total",
      icon: TrendingUp,
      data: dashboardKpis.series?.revenue || [],
    },
    {
      label: "Active clients",
      value: activeClients,
      trend: `${trialClients} on trial`,
      icon: Building2,
      data: dashboardKpis.series?.activeClients || [],
    },
    {
      label: "Verifications this month",
      value: totalVerifications.toLocaleString(),
      trend: "Current month",
      icon: Activity,
      data: dashboardKpis.series?.verifications || [],
    },
    {
      label: "Open support tickets",
      value: openTickets,
      trend: overdueInvoices
        ? `${overdueInvoices} invoices overdue`
        : "all invoices current",
      icon: LifeBuoy,
      data: dashboardKpis.series?.tickets || [],
    },
  ];

  const funnelCounts = LEAD_STATUSES.map(
    (status) => dashboard.leadFunnel.find((item) => item.status === status)?.count || 0
  );

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="Platform overview"
        subtitle={`${today} · MorlyIQ Admin Console`}
      />

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="flex justify-between items-start">
              <div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: C.textMute,
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.3,
                  }}
                >
                  {k.label}
                </div>
                <div
                  style={{
                    fontSize: 25,
                    fontWeight: 800,
                    color: C.text,
                    marginTop: 8,
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  {k.value}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 6,
                    fontSize: 12,
                    fontFamily: "Inter, sans-serif",
                    color: C.success,
                    fontWeight: 600,
                  }}
                >
                  <TrendingUp size={12} /> {k.trend}
                </div>
              </div>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 9,
                  background: C.blueSoft,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <k.icon size={16} color={C.navy} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <MiniBar data={k.data} />
            </div>
          </Card>
        ))}
      </div>

      {/* Detailed Overview Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5">
        <Card>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginBottom: 14,
            }}
          >
            Clients by plan
          </div>
          <div className="flex flex-col gap-2.5">
            {plans.map((p) => {
              const count = p.count;
              const max = Math.max(
                ...plans.map((plan) => plan.count),
                1
              );
              return (
                <div key={p.id} className="flex items-center gap-2.5">
                  <div
                    className="w-32 sm:w-36 text-[12.5px] truncate"
                    style={{ color: C.textMute, fontFamily: "Inter, sans-serif" }}
                    title={p.name}
                  >
                    {p.name}
                  </div>
                  <div
                    className="flex-1 h-[9px] rounded-full overflow-hidden"
                    style={{ background: C.blueSoft2 }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${(count / max) * 100}%`,
                        background: C.blue,
                      }}
                    />
                  </div>
                  <div
                    className="w-6 text-[12.5px] text-right"
                    style={{
                      color: C.text,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {count}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="mt-4 pt-3.5"
            style={{ borderTop: `1px solid ${C.border}` }}
          >
            <div
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: C.text,
                marginBottom: 10,
              }}
            >
              Lead funnel
            </div>
            <div className="flex items-end gap-2 overflow-x-auto pb-1">
              {LEAD_STATUSES.map((s, i) => (
                <div key={s} className="flex-1 text-center min-w-[55px]">
                  <div className="h-[60px] flex items-end justify-center">
                    <div
                      className="w-3/5 rounded-t-md transition-all duration-300"
                      style={{
                        height: `${Math.max(
                          (funnelCounts[i] / Math.max(...funnelCounts, 1)) * 100,
                          8
                        )}%`,
                        background:
                          STATUS_TONE[s] === "success"
                            ? C.success
                            : STATUS_TONE[s] === "danger"
                            ? C.danger
                            : C.blue,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 10.5,
                      color: C.textMute,
                      marginTop: 4,
                    }}
                  >
                    {s}
                  </div>
                  <div
                    style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: 11.5,
                      color: C.text,
                      fontWeight: 600,
                    }}
                  >
                    {funnelCounts[i]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              marginBottom: 12,
            }}
          >
            Recent activity
          </div>
          <div className="flex flex-col gap-3">
            {recentActivity.map((a) => {
              const ActivityIcon = ACTIVITY_ICONS[a.kind] || Building2;
              return (
              <div key={a.id} className="flex gap-2.5 items-start">
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: C.blueSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <ActivityIcon size={13} color={C.navy} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 12.5,
                      color: C.text,
                    }}
                    className="truncate sm:whitespace-normal"
                  >
                    {a.text}
                  </div>
                  <div
                    style={{
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      color: C.textFaint,
                      marginTop: 2,
                    }}
                  >
                    {a.time}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          {insurerIssues > 0 && (
            <div
              className="mt-3.5 pt-3 text-[11.5px]"
              style={{
                color: C.danger,
                fontFamily: "Inter, sans-serif",
                borderTop: `1px solid ${C.border}`,
              }}
            >
              {insurerIssues} insurer connection needs attention.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
