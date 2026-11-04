import React, { useEffect, useState } from "react";
import { Card } from "../components/common/Card";
import { SectionHeader } from "../components/common/Feedback";
import { fetchDashboardStatsApi } from "../services/dashboardService";
import { useApp } from "../store/useApp";

const ROLE_WIDGETS = {
  Owner: {
    verification: "full",
    usage: "full",
    revenue: "full",
    risk: "full",
    insurance: "full",
    cdt: "full",
  },
  Manager: {
    verification: "full",
    usage: "full",
    revenue: "full",
    risk: "full",
    insurance: "full",
    cdt: "full",
  },
  Billing: {
    verification: "full",
    usage: "full",
    revenue: "full",
    risk: "primary",
    insurance: "full",
    cdt: "full",
  },
  "Front Desk": {
    verification: "primary",
    usage: "hidden",
    revenue: "hidden",
    risk: "hidden",
    insurance: "compact",
    cdt: "compact",
  },
  Dentist: {
    verification: "compact",
    usage: "hidden",
    revenue: "hidden",
    risk: "hidden",
    insurance: "hidden",
    cdt: "primary",
  },
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const emptyDashboardStats = () => ({
  verification: { pending: 0, completed: 0, failed: 0 },
  revenueSaved: 0,
  risk: { high: 0, medium: 0 },
  payers: [],
  subscription: null,
  cdtCodes: [],
});

const normalizeRole = (role) => {
  const match = Object.keys(ROLE_WIDGETS).find(
    (key) => key.toLowerCase() === String(role || "").trim().toLowerCase()
  );
  return match || "Front Desk";
};

function CardTitle({ children }) {
  return (
    <div className="text-[12px] text-textMute font-sans font-semibold uppercase tracking-[0.4px]">
      {children}
    </div>
  );
}

function VerificationCard({ counts, compact }) {
  return (
    <Card>
      <CardTitle>Today&apos;s verifications</CardTitle>
      <div className={`flex font-sans ${compact ? "gap-2.5 mt-2" : "gap-3.5 mt-2.5"}`}>
        <div>
          <div className={`${compact ? "text-[19px]" : "text-[22px]"} font-bold text-brand-text`}>{counts.pending}</div>
          <div className="text-[11.5px] text-textMute">Pending</div>
        </div>
        <div>
          <div className={`${compact ? "text-[19px]" : "text-[22px]"} font-bold text-brand-success`}>{counts.completed}</div>
          <div className="text-[11.5px] text-textMute">Completed</div>
        </div>
        <div>
          <div className={`${compact ? "text-[19px]" : "text-[22px]"} font-bold text-brand-danger`}>{counts.failed}</div>
          <div className="text-[11.5px] text-textMute">Failed</div>
        </div>
      </div>
    </Card>
  );
}

function UsageCard({ subscription, loading }) {
  const used = Number(subscription?.usage?.verificationsUsed) || 0;
  const limit = subscription?.usage?.limit;
  const percent = Math.max(0, Math.min(100, Number(subscription?.usage?.percent) || 0));
  const limitLabel = limit === null ? "Unlimited" : (limit === undefined ? "—" : Number(limit).toLocaleString());

  return (
    <Card>
      <CardTitle>Monthly usage</CardTitle>
      <div className="text-[22px] font-bold text-brand-text mt-2.5 font-sans">
        {loading ? "—" : used.toLocaleString()} / {limitLabel}
      </div>
      <div className="h-1.5 bg-brand-border rounded-full mt-2 overflow-hidden">
        <div className="h-full bg-brand-blue rounded-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <div className="text-[11.5px] text-textMute mt-1.5 font-sans truncate">
        {loading ? "Loading plan usage..." : subscription?.plan?.name || "Plan usage unavailable"}
      </div>
    </Card>
  );
}

function RevenueCard({ amount }) {
  return (
    <Card>
      <CardTitle>Revenue saved</CardTitle>
      <div className="text-[22px] font-bold text-brand-text mt-2.5 font-sans">
        ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </div>
      <div className="text-[11.5px] text-textMute mt-1.5 font-sans">
        Est. insurance payments confirmed pre-treatment
      </div>
    </Card>
  );
}

function RiskCard({ counts }) {
  const total = counts.high + counts.medium;
  return (
    <Card>
      <CardTitle>Claim-risk alerts</CardTitle>
      <div className={`text-[22px] font-bold mt-2.5 font-sans ${counts.high ? "text-brand-danger" : "text-brand-text"}`}>
        {total}
      </div>
      <div className="text-[11.5px] text-textMute mt-1.5 font-sans">
        {counts.high} high · {counts.medium} medium risk
      </div>
    </Card>
  );
}

function InsuranceCard({ rows, compact }) {
  const visibleRows = rows.slice(0, compact ? 3 : 6);
  const max = Math.max(...visibleRows.map((row) => row.count), 1);
  return (
    <Card>
      <div className="text-[13px] font-semibold text-brand-text font-sans mb-3.5">Insurance breakdown</div>
      {!visibleRows.length ? (
        <div className="py-6 text-center font-sans text-[12px] text-textFaint">No patient payer data yet.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibleRows.map((row) => (
            <div key={row.name} className="flex items-center gap-2.5">
              <div className="w-[130px] text-[12.5px] text-textMute font-sans truncate" title={row.name}>{row.name}</div>
              <div className="flex-1 h-2 bg-blueSoft2 rounded-full overflow-hidden">
                <div className="h-full bg-brand-blue rounded-full transition-all duration-300" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
              <div className="w-[18px] text-[12px] text-brand-text font-mono text-right">{row.count}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function CdtCard({ rows, loading }) {
  return (
    <Card>
      <div className="text-[13px] font-semibold text-brand-text font-sans mb-3.5">Top CDT codes this month</div>
      {loading ? (
        <div className="py-6 text-center font-sans text-[12px] text-textFaint">Loading CDT codes...</div>
      ) : !rows.length ? (
        <div className="py-6 text-center font-sans text-[12px] text-textFaint">No CDT codes are saved in the catalogue.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {rows.map((row) => (
            <div key={row.code} className="border border-brand-border rounded-[9px] py-2 px-2.5 font-mono text-[12px] text-brand-text bg-[#F4F7FD]">
              {row.code}{" "}
              <span className="text-textMute font-sans">· {row.description}</span>{" "}
              <span className="text-navy font-sans font-semibold">· {row.defaultCoverage}%</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { clinics, clinicId, role, currentUser, push } = useApp();

  const canonicalRole = normalizeRole(role);
  const widgets = ROLE_WIDGETS[canonicalRole];
  const showUsage = widgets.usage !== "hidden";
  const [stats, setStats] = useState(emptyDashboardStats);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!clinicId) {
      setStats(emptyDashboardStats());
      setStatsLoading(false);
      return undefined;
    }
    let active = true;
    setStats(emptyDashboardStats());
    setStatsLoading(true);
    fetchDashboardStatsApi(clinicId)
      .then((data) => {
        if (!active) return;
        setStats({
          verification: data?.verification || { pending: 0, completed: 0, failed: 0 },
          revenueSaved: Number(data?.revenueSaved) || 0,
          risk: data?.risk || { high: 0, medium: 0 },
          payers: safeArray(data?.payers),
          subscription: data?.subscription || null,
          cdtCodes: safeArray(data?.cdtCodes),
        });
      })
      .catch((error) => {
        if (active) {
          push(error.message, "danger");
        }
      })
      .finally(() => active && setStatsLoading(false));
    return () => { active = false; };
  }, [clinicId, push]);

  const clinicName = clinics.find((clinic) => clinic.id === clinicId)?.name || "Active clinic";
  const firstName = String(currentUser?.name || "Team").trim().split(/\s+/)[0];
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
  const showInsights = widgets.insurance !== "hidden" || widgets.cdt !== "hidden";

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title={`Good morning, ${firstName}`}
        subtitle={`${dateLabel} · ${clinicName} · ${canonicalRole}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {widgets.verification !== "hidden" && (
          <VerificationCard counts={stats.verification} compact={widgets.verification === "compact"} />
        )}
        {showUsage && <UsageCard subscription={stats.subscription} loading={statsLoading} />}
        {widgets.revenue !== "hidden" && <RevenueCard amount={stats.revenueSaved} />}
        {widgets.risk !== "hidden" && <RiskCard counts={stats.risk} />}
      </div>

      {showInsights && (
        <div className={`grid grid-cols-1 gap-3.5 ${widgets.insurance !== "hidden" && widgets.cdt !== "hidden" ? "lg:grid-cols-[1.1fr_1fr]" : "lg:grid-cols-1"}`}>
          {widgets.insurance !== "hidden" && (
            <InsuranceCard rows={stats.payers} compact={widgets.insurance === "compact"} />
          )}
          {widgets.cdt !== "hidden" && (
            <CdtCard rows={stats.cdtCodes} loading={statsLoading} />
          )}
        </div>
      )}
    </div>
  );
}
