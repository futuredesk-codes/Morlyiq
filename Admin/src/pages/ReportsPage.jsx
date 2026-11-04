import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { C } from "../constants/theme.js";
import { canAdminDo, LEAD_STATUSES } from "../constants/navigation.js";
import { Card, SectionHeader } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { Select } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { fetchReportOverviewApi } from "../services/reportService.js";

const EMPTY_REPORT = {
  clients: [],
  clientOptions: [],
  employeePerformance: [],
  leadFunnel: [],
  healthcareWorkflow: [],
};

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

function downloadCsv(report, range, name) {
  const rows = [
    ["MorlyIQ Admin Report"],
    ["Period", range],
    ["Generated", report.generatedAt || new Date().toISOString()],
    [],
    ["Client", "Plan", "Users", "Features enabled", "Status"],
    ...report.clients.map((client) => [
      client.name,
      client.planName,
      client.users,
      `${client.featuresEnabled}/${client.totalFeatures}`,
      client.status,
    ]),
    [],
    ["Employee", "Leads", "Calls", "Follow-ups", "Won"],
    ...report.employeePerformance.map((employee) => [
      employee.employee,
      employee.leads,
      employee.calls,
      employee.followups,
      employee.won,
    ]),
    [],
    ["Healthcare workflow", "Value"],
    ...report.healthcareWorkflow.map((item) => [item.label, item.value]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { currentUser, push, logAudit } = useAdmin();
  const canExport = canAdminDo(currentUser, "reports", "export");
  const [clientFilter, setClientFilter] = useState("all");
  const [range, setRange] = useState("30d");
  const [report, setReport] = useState(EMPTY_REPORT);
  const [loading, setLoading] = useState(true);

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchReportOverviewApi({
        range,
        clientId: clientFilter === "all" ? "" : clientFilter,
      });
      setReport({ ...EMPTY_REPORT, ...data });
    } catch (error) {
      push(error.message || "Report data could not be loaded", "danger");
    } finally {
      setLoading(false);
    }
  }, [clientFilter, push, range]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const funnelCounts = useMemo(
    () => LEAD_STATUSES.map(
      (status) => report.leadFunnel.find((item) => item.status === status)?.count || 0
    ),
    [report.leadFunnel]
  );

  function exportReport(name) {
    downloadCsv(report, range, name);
    logAudit("Report exported", name, "info");
    push(`${name} exported — permission checked and logged`);
  }

  return (
    <div>
      <SectionHeader
        title="Reports"
        subtitle="Client, employee, lead funnel and healthcare workflow oversight"
      />

      <div className="flex gap-2.5 mb-4 flex-wrap items-center">
        <Select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          style={{ width: 220 }}
        >
          <option value="all">All clients</option>
          {report.clientOptions.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </Select>
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
          <option value="all">All time</option>
        </Select>
        <Btn
          variant="outline"
          icon={Download}
          disabled={!canExport || loading}
          title={canExport ? "Export report" : "Missing reports:export permission"}
          onClick={() => exportReport("Client & feature overview.csv")}
        >
          Export
        </Btn>
      </div>

      {/* Client Overview Table */}
      <div className="flex justify-between items-center mb-2.5">
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: C.text,
          }}
        >
          Client overview
        </div>
      </div>
      <Card noPad style={{ marginBottom: 24 }} className="overflow-x-auto">
        <div
          className="min-w-[650px] grid grid-cols-[1.4fr_1.1fr_0.8fr_1fr_0.9fr] p-[10px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Client</div>
          <div>Plan</div>
          <div>Users</div>
          <div>Features enabled</div>
          <div>Status</div>
        </div>

        {report.clients.map((client) => (
          <div
            key={client.id}
            className="min-w-[650px] grid grid-cols-[1.4fr_1.1fr_0.8fr_1fr_0.9fr] items-center p-[10px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ fontWeight: 600, color: C.navy }}>{client.name}</div>
            <div style={{ color: C.textMute }}>{client.planName}</div>
            <div style={{ color: C.textMute }}>{client.users}</div>
            <div style={{ color: C.textMute }}>
              {client.featuresEnabled} / {client.totalFeatures}
            </div>
            <div>
              <StatusBadge status={client.status} />
            </div>
          </div>
        ))}
      </Card>

      {/* Employee Performance Table */}
      <div
        style={{
          fontFamily: "Inter, sans-serif",
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
          marginBottom: 10,
        }}
      >
        Employee performance
      </div>
      <Card noPad style={{ marginBottom: 24 }} className="overflow-x-auto">
        <div
          className="min-w-[600px] grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr] p-[10px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Employee</div>
          <div>Leads</div>
          <div>Calls</div>
          <div>Follow-ups</div>
          <div>Won</div>
        </div>

        {report.employeePerformance.map((employee) => (
          <div
            key={employee.id || employee.employee}
            className="min-w-[600px] grid grid-cols-[1.2fr_0.8fr_0.8fr_0.9fr_0.8fr] items-center p-[10px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div style={{ fontWeight: 600, color: C.text }}>{employee.employee}</div>
            <div style={{ color: C.textMute }}>{employee.leads}</div>
            <div style={{ color: C.textMute }}>{employee.calls}</div>
            <div style={{ color: C.textMute }}>{employee.followups}</div>
            <div style={{ color: C.success, fontWeight: 600 }}>{employee.won}</div>
          </div>
        ))}
      </Card>

      {/* Funnel & Healthcare Workflow Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
            Lead funnel
          </div>
          <div className="flex flex-col gap-2">
            {LEAD_STATUSES.map((status, index) => (
              <div key={status} className="flex items-center gap-2.5">
                <div
                  className="w-20 text-xs truncate"
                  style={{ color: C.textMute, fontFamily: "Inter, sans-serif" }}
                >
                  {status}
                </div>
                <div
                  className="flex-1 h-[9px] rounded-full overflow-hidden"
                  style={{ background: C.blueSoft2 }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (funnelCounts[index] / Math.max(...funnelCounts, 1)) * 100
                      }%`,
                      background: C.blue,
                    }}
                  />
                </div>
                <div
                  className="w-5 text-xs text-right"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: C.text,
                  }}
                >
                  {funnelCounts[index]}
                </div>
              </div>
            ))}
          </div>
        </Card>

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
            Healthcare workflow (est.)
          </div>
          <div className="flex flex-col gap-2">
            {report.healthcareWorkflow.map((item) => (
              <div
                key={item.key || item.label}
                className="flex justify-between text-[12.5px]"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                <span style={{ color: C.textMute }}>{item.label}</span>
                <span
                  style={{
                    color: C.text,
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {item.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <Btn
            size="sm"
            variant="outline"
            icon={Download}
            disabled={!canExport || loading}
            title={canExport ? "Export report" : "Missing reports:export permission"}
            onClick={() => exportReport("Healthcare workflow report.csv")}
            style={{ marginTop: 14 }}
          >
            Export this report
          </Btn>
        </Card>
      </div>
    </div>
  );
}
