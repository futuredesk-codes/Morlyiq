import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, RefreshCw, Server, ShieldCheck } from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Btn } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { EmptyState, SectionHeader } from "../components/common/Feedback";
import { SearchBox } from "../components/common/FormControls";
import { fetchInsuranceConnectionsApi } from "../services/insuranceConnectionService";
import { useApp } from "../store/useApp";

const STATUS_PRESENTATION = {
  active: { label: "Active", tone: "success" },
  pending: { label: "Pending", tone: "blue" },
  inactive: { label: "Inactive", tone: "neutral" },
  error: { label: "Error", tone: "danger" },
};

const SUPPORT_PRESENTATION = {
  SUPPORTED: { label: "Available", tone: "success" },
  ENROLLMENT_REQUIRED: { label: "Enrollment required", tone: "warn" },
  NOT_SUPPORTED: { label: "Not supported", tone: "danger" },
  UNKNOWN: { label: "Not mapped", tone: "neutral" },
};

const fallbackStatus = (connection) => {
  if (connection.readiness === "sandbox_ready") return "active";
  if (["provider_setup_required", "production_enrollment_required"].includes(connection.readiness)) return "pending";
  return "error";
};

const relativeTime = (value) => {
  if (!value) return "Not checked";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not checked";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const exactTime = (value) => {
  if (!value) return "Not checked";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not checked";
  return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
};

export default function InsurersPage() {
  const { clinicId, clinics } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData((current) => current?.clinic?.id === clinicId ? current : null);
    fetchInsuranceConnectionsApi(clinicId)
      .then((response) => {
        if (!active) return;
        setData(response);
        setUpdatedAt(new Date());
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [clinicId, reload]);

  const connections = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = data?.connections || [];
    if (!normalized) return list;
    return list.filter(({ payer, integrationType }) => [
      payer?.displayName,
      payer?.primaryPayerId,
      payer?.stediId,
      integrationType,
    ].some((value) => String(value || "").toLowerCase().includes(normalized)));
  }, [data, query]);

  const activeClinic = clinics.find((clinic) => clinic.id === clinicId);
  const activeCount = (data?.connections || []).filter((item) => (item.status || fallbackStatus(item)) === "active").length;

  return (
    <div>
      <SectionHeader
        title="Insurance Connections"
        subtitle={`Payers connected to ${data?.clinic?.name || activeClinic?.name || "your active clinic"}`}
        action={
          <Btn
            variant="outline"
            icon={RefreshCw}
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
          >
            {loading && data ? "Refreshing..." : "Refresh status"}
          </Btn>
        }
      />

      <Card noPad className="overflow-x-auto mb-4">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(190px, 1fr))",
            minWidth: 620,
          }}
        >
          <div className="flex items-center gap-2.5 px-4 py-3.5">
            <ShieldCheck size={17} className="text-navy shrink-0" />
            <div className="min-w-0">
              <div className="font-sans text-[11px] uppercase font-bold text-textMute">Provider setup</div>
              <div className="font-sans text-[13px] font-semibold text-brand-text mt-0.5">
                {data?.provider?.eligibilityReady ? "Ready" : "Setup required"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-l border-brand-border">
            <Server size={17} className="text-navy shrink-0" />
            <div className="min-w-0">
              <div className="font-sans text-[11px] uppercase font-bold text-textMute">Connected payers</div>
              <div className="font-sans text-[13px] font-semibold text-brand-text mt-0.5">
                {data ? `${activeCount} active of ${data.connections.length}` : "Loading..."}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-3.5 border-l border-brand-border">
            <Clock3 size={17} className="text-navy shrink-0" />
            <div className="min-w-0">
              <div className="font-sans text-[11px] uppercase font-bold text-textMute">Status refreshed</div>
              <div className="font-sans text-[13px] font-semibold text-brand-text mt-0.5">
                {updatedAt ? relativeTime(updatedAt) : "Not refreshed"}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-3.5 rounded-[11px] border border-red-200 bg-dangerSoft px-4 py-3 flex items-start gap-2 font-sans text-[13px] text-brand-danger">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Latest insurance status could not be loaded</div>
            <div className="mt-0.5">{error}{data ? " Existing results are still shown below." : ""}</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <SearchBox value={query} onChange={setQuery} placeholder="Search insurance connections..." />
        {data?.directory && (
          <div className="flex items-center gap-2 font-sans text-[11.5px] text-textMute">
            <span>Directory checked {relativeTime(data.directory.refreshedAt)}</span>
            {data.directory.stale && <Badge text="Stale cache" tone="warn" />}
          </div>
        )}
      </div>

      <Card noPad className="overflow-hidden">
        {!data && loading ? (
          <div className="py-12 text-center font-sans text-[13px] text-textMute">Loading insurance connections...</div>
        ) : connections.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            text={query ? "No insurance connection matches this search." : "No insurance payers are currently used by patients in this clinic."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full font-sans"
              style={{ minWidth: 900, borderCollapse: "collapse", tableLayout: "fixed" }}
            >
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead>
                <tr className="bg-[#F4F7FD] text-[10.5px] font-bold text-textMute uppercase">
                  <th className="px-4 py-[11px] text-left">Insurer</th>
                  <th className="px-4 py-[11px] text-left">Integration type</th>
                  <th className="px-4 py-[11px] text-left">Patients</th>
                  <th className="px-4 py-[11px] text-left">Eligibility</th>
                  <th className="px-4 py-[11px] text-left">Last checked</th>
                  <th className="px-4 py-[11px] text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((connection) => {
                const status = connection.status || fallbackStatus(connection);
                const statusView = STATUS_PRESENTATION[status] || STATUS_PRESENTATION.error;
                const support = SUPPORT_PRESENTATION[connection.transactionSupport?.eligibility]
                  || SUPPORT_PRESENTATION.UNKNOWN;
                return (
                  <tr
                    key={connection.id}
                    className="border-t border-brand-border text-[13px] hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-3.5 align-middle min-w-0">
                      <div className="font-semibold text-brand-text truncate">{connection.payer.displayName}</div>
                      <div className="text-[11.5px] text-textMute mt-0.5">
                        {connection.payer.primaryPayerId ? `Payer ID ${connection.payer.primaryPayerId}` : "Payer ID unavailable"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-textMute">{connection.integrationType || "Stedi / EDI Payer"}</td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="font-semibold text-brand-text">{connection.usage?.patients || 0}</div>
                      {connection.usage?.secondaryPolicies > 0 && (
                        <div className="text-[11px] text-textMute">{connection.usage.secondaryPolicies} secondary</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 align-middle"><Badge text={support.label} tone={support.tone} /></td>
                    <td className="px-4 py-3.5 align-middle text-textMute" title={exactTime(connection.lastChecked || data?.directory?.refreshedAt)}>
                      {relativeTime(connection.lastChecked || data?.directory?.refreshedAt)}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <Badge text={statusView.label} tone={statusView.tone} />
                      {connection.statusReason && (
                        <div className="text-[10.5px] leading-4 text-textMute mt-1.5">{connection.statusReason}</div>
                      )}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="font-sans text-[11.5px] text-textFaint mt-2.5">
        Status reflects MorlyIQ application access, clinic provider readiness and the latest cached payer-directory capability.
      </div>
    </div>
  );
}
