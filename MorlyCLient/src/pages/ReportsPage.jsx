import React, { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { Card } from "../components/common/Card";
import { Btn } from "../components/common/Button";
import { Pill, SectionHeader } from "../components/common/Feedback";
import { fetchCdtCodesApi } from "../services/cdtService";
import { useApp } from "../store/useApp";
import { usePatients } from "../store/usePatients";

const FILTERS = [
  { key: "all", label: "All time" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "year", label: "This year" },
];

const STATUS_ROWS = [
  { key: "completed", label: "Completed", color: "bg-brand-success", text: "text-brand-success", stroke: "#1E8E5A" },
  { key: "partial", label: "Partial", color: "bg-brand-warn", text: "text-brand-warn", stroke: "#B8791F" },
  { key: "failed", label: "Failed", color: "bg-brand-danger", text: "text-brand-danger", stroke: "#C23B3B" },
  { key: "in_progress", label: "In progress", color: "bg-brand-blue", text: "text-brand-blue", stroke: "#2F6FED" },
  { key: "not_verified", label: "Not verified", color: "bg-[#A8B3C7]", text: "text-textMute", stroke: "#A8B3C7" },
];

const safeArray = (value) => (Array.isArray(value) ? value : []);

const verificationResult = (patient) => patient?.result?.primary || null;

const verificationDate = (patient) =>
  patient?.result?.checkedAt
  || patient?.result?.primary?.checkedAt
  || patient?.appointment
  || null;

const inSelectedPeriod = (patient, period, now) => {
  if (period === "all") return true;
  const raw = verificationDate(patient);
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  if (period === "year") return date.getFullYear() === now.getFullYear();
  const days = period === "30d" ? 30 : 90;
  const cutoff = new Date(now);
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  return date >= cutoff && date <= now;
};

const percent = (value, total) => (total > 0 ? Math.round((value / total) * 100) : 0);

const money = (value, decimals = 0) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(value);

const normalizedNetwork = (result) => {
  const benefitNetwork = safeArray(result?.benefits)
    .map((benefit) => String(benefit?.network || "").toUpperCase())
    .find((value) => value && value !== "NOT_RETURNED");
  return benefitNetwork || String(result?.coverage?.network || "NOT_RETURNED").toUpperCase();
};

const claimRisk = (patient) => {
  const result = verificationResult(patient);
  if (!result) return "not_evaluated";
  const benefits = safeArray(result.benefits);
  const coverage = String(result.coverage?.status || "").toUpperCase();
  const hasErrors = safeArray(result.errors).length > 0;
  const nonCovered = benefits.some((benefit) => String(benefit?.category || "").toLowerCase() === "noncovered");
  const exhaustedMaximum = benefits.some((benefit) =>
    String(benefit?.category || "").toLowerCase() === "limitations"
    && String(benefit?.timePeriod || "").toUpperCase() === "REMAINING"
    && Number(benefit?.amount) === 0
  );
  if (patient.status === "failed" || result.outcome !== "completed" || hasErrors || !coverage.includes("ACTIVE") || nonCovered || exhaustedMaximum) {
    return "high";
  }
  const needsReview = patient.status === "partial"
    || normalizedNetwork(result) === "OUT_OF_NETWORK"
    || safeArray(result.warnings).length > 0
    || benefits.some((benefit) => benefit?.authorizationRequired === true);
  return needsReview ? "medium" : "low";
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function KpiCard({ label, value, detail, tone = "default" }) {
  const valueClass = {
    default: "text-brand-text",
    success: "text-brand-success",
    warn: "text-brand-warn",
    danger: "text-brand-danger",
    blue: "text-navy",
  }[tone];
  return (
    <Card className="p-4 h-full">
      <div className="text-[10.5px] text-textMute font-sans font-bold uppercase tracking-[0.35px]">{label}</div>
      <div className={`text-[21px] font-extrabold mt-1.5 font-sans ${valueClass}`}>{value}</div>
      <div className="text-[10.5px] text-textFaint mt-1 font-sans leading-[1.35]">{detail}</div>
    </Card>
  );
}

function ProgressRow({ label, value, total, color = "bg-brand-blue", detail }) {
  const ratio = percent(value, total);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 font-sans text-[11px] mb-1">
        <span className="text-textMute truncate">{label}</span>
        <span className="text-brand-text font-semibold shrink-0">{value.toLocaleString()} <span className="text-textFaint font-normal">({ratio}%)</span></span>
      </div>
      <div className="h-1.5 bg-blueSoft2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${ratio}%` }} />
      </div>
      {detail && <div className="font-sans text-[10.5px] text-textFaint mt-1">{detail}</div>}
    </div>
  );
}

function StatusDonut({ counts, total }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  let consumed = 0;

  return (
    <div className="shrink-0">
      <svg width="82" height="82" viewBox="0 0 82 82" aria-label={`${total} patients by verification status`}>
        <circle cx="41" cy="41" r={radius} fill="none" stroke="#EEF2F8" strokeWidth="9" />
        {total > 0 && STATUS_ROWS.map((status) => {
          const value = counts[status.key];
          if (!value) return null;
          const segment = (value / total) * circumference;
          const gap = Math.min(3, segment * 0.12);
          const offset = -consumed;
          consumed += segment;
          return (
            <circle
              key={status.key}
              cx="41"
              cy="41"
              r={radius}
              fill="none"
              stroke={status.stroke}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${Math.max(segment - gap, 0)} ${circumference}`}
              strokeDashoffset={offset}
              transform="rotate(-90 41 41)"
            />
          );
        })}
        <text x="41" y="39" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0F1B33" fontFamily="Inter, sans-serif">{total}</text>
        <text x="41" y="52" textAnchor="middle" fontSize="7.5" fill="#8C97AE" fontFamily="Inter, sans-serif">Patients</text>
      </svg>
    </div>
  );
}

function VerificationStatusCard({ counts, total }) {
  return (
    <Card className="p-3.5 h-full min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="font-sans text-[13.5px] font-bold text-brand-text">Verifications by status</div>
          <div className="font-sans text-[10.5px] text-textMute mt-0.5">Current patient verification workflow</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="space-y-1.5 flex-1 min-w-0">
          {STATUS_ROWS.map((status) => (
            <div key={status.key} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full shrink-0 ${status.color}`} />
              <div className="font-sans text-[10.5px] text-textMute flex-1 truncate">{status.label}</div>
              <div className={`font-sans text-[11.5px] font-bold ${status.text}`}>{counts[status.key]}</div>
              <div className="font-sans text-[9.5px] text-textFaint w-7 text-right">{percent(counts[status.key], total)}%</div>
            </div>
          ))}
        </div>
        <StatusDonut counts={counts} total={total} />
      </div>
    </Card>
  );
}

function TrendCard({ rows }) {
  const max = Math.max(...rows.map((row) => row.total), 1);
  return (
    <Card className="p-3.5 h-full min-w-0 overflow-hidden">
      <div className="font-sans text-[13.5px] font-bold text-brand-text">Verification trend</div>
      <div className="font-sans text-[10.5px] text-textMute mt-0.5">Completed, partial and failed checks over six months</div>
      <div className="h-[118px] flex items-end gap-1 mt-2 border-b border-brand-border pb-1.5">
        {rows.map((row) => (
          <div key={row.key} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center gap-1.5">
            <div className="font-mono text-[9.5px] text-textMute">{row.total}</div>
            <div className="w-5 h-[68px] rounded-t-[5px] bg-blueSoft2 overflow-hidden flex flex-col justify-end">
              <div
                className="w-full bg-brand-blue rounded-t-[5px]"
                style={{ height: row.total ? `${Math.max((row.total / max) * 100, 7)}%` : "2px" }}
                title={`${row.label}: ${row.total} checks`}
              />
            </div>
            <div className="font-sans text-[9.5px] text-textFaint truncate">{row.label}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PayerTable({ rows }) {
  const visibleRows = rows.slice(0, 4);
  return (
    <Card className="p-3.5 h-full min-w-0 overflow-hidden">
      <div className="mb-3">
        <div className="font-sans text-[14px] font-bold text-brand-text">Payer performance</div>
        <div className="font-sans text-[11.5px] text-textMute mt-1">Patient volume and verification outcomes by payer</div>
      </div>
      {!visibleRows.length ? (
        <div className="py-7 text-center font-sans text-[12px] text-textFaint">No payer data in this period.</div>
      ) : (
        <div className="space-y-2">
          {visibleRows.map((row) => (
            <div key={row.name} className="rounded-[9px] border border-brand-border px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-sans text-[12px] font-semibold text-brand-text truncate" title={row.name}>{row.name}</div>
                <div className="font-sans text-[11px] font-bold text-navy shrink-0">{row.attempts ? `${percent(row.completed, row.attempts)}% success` : "No checks"}</div>
              </div>
              <div className="flex gap-4 mt-1.5 font-sans text-[10.5px] text-textMute">
                <span><strong className="text-brand-text">{row.patients}</strong> patients</span>
                <span><strong className="text-brand-success">{row.completed}</strong> completed</span>
                <span><strong className={row.issues ? "text-brand-danger" : "text-brand-text"}>{row.issues}</strong> issues</span>
              </div>
            </div>
          ))}
          {rows.length > visibleRows.length && <div className="font-sans text-[10.5px] text-textFaint pt-1">Showing top {visibleRows.length} of {rows.length} payers</div>}
        </div>
      )}
    </Card>
  );
}

function CdtTable({ rows, loading }) {
  const visibleRows = rows.slice(0, 6);
  return (
    <Card className="p-3.5 h-full min-w-0 overflow-hidden">
      <div className="mb-3">
        <div className="font-sans text-[14px] font-bold text-brand-text">CDT utilization</div>
        <div className="font-sans text-[11.5px] text-textMute mt-1">Most frequently requested procedure codes</div>
      </div>
      {loading && <div className="py-7 text-center font-sans text-[12px] text-textFaint">Loading CDT catalogue...</div>}
      {!loading && !visibleRows.length && <div className="py-7 text-center font-sans text-[12px] text-textFaint">No CDT activity in this period.</div>}
      {!loading && visibleRows.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {visibleRows.map((row) => (
            <div key={row.code} className="rounded-[9px] border border-brand-border px-3 py-2.5 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="font-mono text-[11.5px] font-semibold text-navy">{row.code}</div>
                <div className="font-sans text-[10px] text-textFaint shrink-0">{row.count} pt.</div>
              </div>
              <div className="font-sans text-[10.5px] text-textMute truncate mt-1" title={row.description}>{row.description}</div>
              <div className="font-sans text-[10px] text-textFaint mt-1">Default: {row.defaultCoverage === null ? "—" : `${row.defaultCoverage}%`}</div>
            </div>
          ))}
          {rows.length > visibleRows.length && <div className="col-span-2 font-sans text-[10.5px] text-textFaint pt-1">Showing top {visibleRows.length} of {rows.length} codes</div>}
        </div>
      )}
    </Card>
  );
}

export default function ReportsPage() {
  const { patients, clinicId, clinics, push } = useApp();
  const [period, setPeriod] = useState("all");
  const [cdtCatalogue, setCdtCatalogue] = useState([]);
  const [cdtLoading, setCdtLoading] = useState(true);
  usePatients();

  useEffect(() => {
    let active = true;
    setCdtLoading(true);
    fetchCdtCodesApi()
      .then((codes) => active && setCdtCatalogue(safeArray(codes)))
      .catch((error) => {
        if (active) {
          setCdtCatalogue([]);
          push(error.message, "danger");
        }
      })
      .finally(() => active && setCdtLoading(false));
    return () => { active = false; };
  }, [push]);

  const report = useMemo(() => {
    const now = new Date();
    const scoped = safeArray(patients).filter((patient) => patient.clinicId === clinicId);
    const filtered = scoped.filter((patient) => inSelectedPeriod(patient, period, now));
    const counts = Object.fromEntries(STATUS_ROWS.map((status) => [status.key, 0]));
    filtered.forEach((patient) => {
      const status = counts[patient.status] === undefined ? "not_verified" : patient.status;
      counts[status] += 1;
    });

    const attempts = counts.completed + counts.partial + counts.failed;
    const issues = counts.partial + counts.failed;
    const results = filtered.map(verificationResult).filter(Boolean);
    const activeCoverage = results.filter((result) => String(result.coverage?.status || "").toUpperCase().includes("ACTIVE")).length;
    const networks = results.reduce((totals, result) => {
      const network = normalizedNetwork(result);
      if (network === "IN_NETWORK") totals.inNetwork += 1;
      else if (network === "OUT_OF_NETWORK") totals.outOfNetwork += 1;
      else totals.notReturned += 1;
      return totals;
    }, { inNetwork: 0, outOfNetwork: 0, notReturned: 0 });

    const payerMap = new Map();
    filtered.forEach((patient) => {
      const name = String(patient.payer || "Unknown payer").trim() || "Unknown payer";
      const row = payerMap.get(name) || { name, patients: 0, completed: 0, issues: 0, attempts: 0 };
      row.patients += 1;
      if (["completed", "partial", "failed"].includes(patient.status)) row.attempts += 1;
      if (patient.status === "completed") row.completed += 1;
      if (["partial", "failed"].includes(patient.status)) row.issues += 1;
      payerMap.set(name, row);
    });
    const payers = [...payerMap.values()].sort((a, b) => b.patients - a.patients || a.name.localeCompare(b.name));

    const cdtByCode = new Map(cdtCatalogue.map((item) => [item.code, item]));
    const codeMap = new Map();
    filtered.forEach((patient) => {
      new Set(safeArray(patient.codes).map((code) => String(code).trim().toUpperCase()).filter(Boolean))
        .forEach((code) => codeMap.set(code, (codeMap.get(code) || 0) + 1));
    });
    const cdt = [...codeMap.entries()]
      .map(([code, count]) => ({
        code,
        count,
        description: cdtByCode.get(code)?.description || "Dental procedure",
        defaultCoverage: Number.isFinite(Number(cdtByCode.get(code)?.defaultCoverage))
          ? Number(cdtByCode.get(code).defaultCoverage)
          : null,
      }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 10);

    const trend = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      trend.push({ key, label: date.toLocaleDateString("en-US", { month: "short" }), total: 0 });
    }
    const trendByKey = new Map(trend.map((row) => [row.key, row]));
    filtered.forEach((patient) => {
      if (!["completed", "partial", "failed"].includes(patient.status)) return;
      const raw = patient?.result?.checkedAt || patient?.result?.primary?.checkedAt;
      const date = raw ? new Date(raw) : null;
      if (!date || Number.isNaN(date.getTime())) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (trendByKey.has(key)) trendByKey.get(key).total += 1;
    });

    const risks = filtered.reduce((totals, patient) => {
      totals[claimRisk(patient)] += 1;
      return totals;
    }, { high: 0, medium: 0, low: 0, not_evaluated: 0 });

    const policies = filtered.flatMap((patient) => [
      patient?.result?.primary,
      patient?.result?.secondary,
    ].filter(Boolean));
    const benefitRows = policies.reduce((sum, result) => sum + (Number(result?.benefitRowCount) || safeArray(result?.benefits).length), 0);
    const warnings = policies.reduce((sum, result) => sum + safeArray(result?.warnings).length, 0);
    const errors = policies.reduce((sum, result) => sum + safeArray(result?.errors).length, 0);
    const cobPatients = filtered.filter((patient) => patient.cob).length;
    const submittedClaims = filtered.filter((patient) => patient.claimStatus === "submitted").length;

    const priced = filtered.filter((patient) => safeArray(patient?.result?.cdtResults).length > 0);
    const revenueConfirmed = priced.reduce((total, patient) =>
      total + safeArray(patient.result.cdtResults).reduce((sum, row) => sum + (Number(row.insPay) || 0), 0), 0) / 100;
    const patientResponsibility = priced.reduce((total, patient) =>
      total + safeArray(patient.result.cdtResults).reduce((sum, row) => sum + (Number(row.ptPay) || 0), 0), 0) / 100;

    return {
      total: filtered.length,
      counts,
      attempts,
      issues,
      activeCoverage,
      networks,
      payers,
      cdt,
      trend,
      risks,
      policies: policies.length,
      averageBenefitRows: policies.length ? Math.round(benefitRows / policies.length) : 0,
      warnings,
      errors,
      cobPatients,
      submittedClaims,
      pricedCount: priced.length,
      revenueConfirmed,
      averagePatientResponsibility: priced.length ? patientResponsibility / priced.length : null,
    };
  }, [patients, clinicId, period, cdtCatalogue]);

  const clinicName = clinics.find((clinic) => clinic.id === clinicId)?.name || "Active clinic";

  function exportCsv() {
    const rows = [
      ["Section", "Category", "Metric", "Value"],
      ...STATUS_ROWS.map((status) => ["Verification status", status.label, "Patients", report.counts[status.key]]),
      ...report.payers.map((row) => ["Payer performance", row.name, "Patients", row.patients]),
      ...report.payers.map((row) => ["Payer performance", row.name, "Completed", row.completed]),
      ...report.cdt.map((row) => ["CDT utilization", row.code, row.description, row.count]),
      ["Claim risk", "High", "Patients", report.risks.high],
      ["Claim risk", "Medium", "Patients", report.risks.medium],
      ["Claim risk", "Low", "Patients", report.risks.low],
      ["Workflow", "Claims", "Submitted", report.submittedClaims],
      ["Workflow", "COB", "Patients with secondary insurance", report.cobPatients],
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `morlyiq-report-${clinicId}-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    push("Aggregated report exported");
  }

  function printReport() {
    window.print();
  }

  return (
    <div>
      <SectionHeader
        title="Reports"
        subtitle={`${clinicName} · Verification, coverage and revenue-cycle analytics`}
        action={(
          <div className="flex gap-2">
            <Btn variant="outline" icon={Download} onClick={printReport}>Print / PDF</Btn>
            <Btn variant="outline" icon={FileSpreadsheet} onClick={exportCsv}>Export CSV</Btn>
          </div>
        )}
      />

      <div className="flex items-center gap-2 flex-wrap mb-[18px]">
        <span className="font-sans text-[12px] font-semibold text-textMute mr-1">Report period</span>
        {FILTERS.map((filter) => (
          <Pill key={filter.key} text={filter.label} active={period === filter.key} onClick={() => setPeriod(filter.key)} />
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Patients in report" value={report.total} detail="Patients matching the selected period" />
        <KpiCard label="Verification attempts" value={report.attempts} detail={`${report.counts.in_progress} currently in progress`} tone="blue" />
        <KpiCard label="Completion rate" value={`${percent(report.counts.completed, report.attempts)}%`} detail={`${report.counts.completed} successful of ${report.attempts} completed attempts`} tone="success" />
        <KpiCard label="Needs attention" value={report.issues} detail={`${report.counts.failed} failed · ${report.counts.partial} partial`} tone={report.issues ? "danger" : "default"} />
      </div>

      <div className="reports-analytics-grid gap-3 mb-4 items-stretch">
        <VerificationStatusCard counts={report.counts} total={report.total} />
        <TrendCard rows={report.trend} />
        <Card className="p-3.5 h-full min-w-0 overflow-hidden">
          <div className="font-sans text-[13.5px] font-bold text-brand-text">Coverage & network</div>
          <div className="font-sans text-[10.5px] text-textMute mt-0.5 mb-3">Returned eligibility signals</div>
          <div className="space-y-2.5">
            <ProgressRow label="Active coverage" value={report.activeCoverage} total={report.attempts} color="bg-brand-success" />
            <ProgressRow label="In network" value={report.networks.inNetwork} total={report.attempts} color="bg-brand-blue" />
            <ProgressRow label="Out of network" value={report.networks.outOfNetwork} total={report.attempts} color="bg-brand-warn" />
            <ProgressRow label="Network not returned" value={report.networks.notReturned} total={report.attempts} color="bg-[#A8B3C7]" />
          </div>
        </Card>
        <Card className="p-3.5 h-full min-w-0 overflow-hidden">
          <div className="font-sans text-[13.5px] font-bold text-brand-text mb-3">Claim-risk distribution</div>
          <div className="space-y-2.5">
            <ProgressRow label="High risk" value={report.risks.high} total={report.total} color="bg-brand-danger" />
            <ProgressRow label="Medium risk" value={report.risks.medium} total={report.total} color="bg-brand-warn" />
            <ProgressRow label="Low risk" value={report.risks.low} total={report.total} color="bg-brand-success" />
            <ProgressRow label="Not evaluated" value={report.risks.not_evaluated} total={report.total} color="bg-[#A8B3C7]" />
          </div>
        </Card>

        <PayerTable rows={report.payers} />
        <CdtTable rows={report.cdt} loading={cdtLoading} />

        <Card className="p-3.5 h-full min-w-0 overflow-hidden">
          <div className="font-sans text-[13.5px] font-bold text-brand-text mb-3">Eligibility response quality</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-brand-text">{report.policies}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Policies checked</div></div>
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-brand-text">{report.averageBenefitRows}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Avg. benefit rows</div></div>
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-brand-warn">{report.warnings}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Payer warnings</div></div>
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-brand-danger">{report.errors}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Payer errors</div></div>
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-navy">{report.submittedClaims}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Claims submitted</div></div>
            <div className="rounded-[8px] bg-[#F4F7FD] p-2.5"><div className="font-sans text-[17px] font-bold text-brand-text">{report.cobPatients}</div><div className="font-sans text-[9.5px] text-textMute mt-0.5">Secondary plans</div></div>
          </div>
        </Card>

        <Card className="p-3.5 h-full min-w-0 overflow-hidden">
          <div className="font-sans text-[13.5px] font-bold text-brand-text mb-3">Financial estimates</div>
          {report.pricedCount ? (
            <div className="space-y-4">
              <div><div className="font-sans text-[11px] uppercase font-bold text-textMute">Revenue confirmed</div><div className="font-sans text-[23px] font-bold text-brand-success mt-1">{money(report.revenueConfirmed)}</div></div>
              <div><div className="font-sans text-[11px] uppercase font-bold text-textMute">Avg. patient responsibility</div><div className="font-sans text-[20px] font-bold text-brand-text mt-1">{money(report.averagePatientResponsibility, 2)}</div></div>
              <div className="font-sans text-[10.5px] text-textFaint">Based on {report.pricedCount} verification result{report.pricedCount === 1 ? "" : "s"} containing fee estimates.</div>
            </div>
          ) : (
            <div className="rounded-[9px] border border-dashed border-brand-border px-3 py-4 font-sans text-[10.5px] text-textMute leading-[1.5]">
              Pricing estimates are unavailable. Standard Stedi eligibility responses return coverage and benefits, not the clinic&apos;s contracted procedure fees.
            </div>
          )}
        </Card>
      </div>

      <div className="font-sans text-[10.5px] text-textFaint">
        All figures are scoped to the active clinic. Default CDT coverage is catalogue guidance and is not a payer guarantee.
      </div>
    </div>
  );
}
