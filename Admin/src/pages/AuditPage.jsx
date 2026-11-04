import React, { useEffect, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Badge, Pill } from "../components/common/Badge.jsx";
import { SearchBox, Select } from "../components/common/FormControls.jsx";
import { Btn } from "../components/common/Button.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { fetchAuditLogsApi } from "../services/auditService.js";

const levelTone = { info: "blue", warn: "warn", error: "danger" };

const formatTimestamp = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
};

export default function AuditPage() {
  const { push } = useAdmin();
  const [logs, setLogs] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ clients: [], actors: [] });
  const [levelFilter, setLevelFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      fetchAuditLogsApi({ level: levelFilter, clientId: clientFilter, actorId: actorFilter, search, page })
        .then((data) => {
          if (!active) return;
          setLogs(data?.logs || []);
          setFilterOptions(data?.filters || { clients: [], actors: [] });
          setPagination(data?.pagination || { page: 1, pages: 1, total: 0 });
        })
        .catch((error) => {
          if (active) push(`Could not load audit logs: ${error.message}`, "danger");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [levelFilter, clientFilter, actorFilter, search, page, reloadKey, push]);

  const chooseLevel = (level) => { setLevelFilter(level); setPage(1); };

  return (
    <div>
      <SectionHeader
        title="Audit Logs"
        subtitle="Immutable record of Admin Console activity across clients, users, plans and platform operations"
        action={<Btn variant="outline" icon={RefreshCw} onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>Refresh</Btn>}
      />

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <SearchBox
          value={search}
          onChange={(value) => { setSearch(value); setPage(1); }}
          placeholder="Search action, target or actor..."
          style={{ width: 280, maxWidth: "100%" }}
        />
        <div className="flex flex-wrap gap-1.5">
          {["all", "info", "warn", "error"].map((level) => (
            <Pill key={level} text={level} active={levelFilter === level} onClick={() => chooseLevel(level)} />
          ))}
        </div>
        <Select value={clientFilter} onChange={(event) => { setClientFilter(event.target.value); setPage(1); }} style={{ width: 210 }}>
          <option value="all">All clients</option>
          {filterOptions.clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </Select>
        <Select value={actorFilter} onChange={(event) => { setActorFilter(event.target.value); setPage(1); }} style={{ width: 230 }}>
          <option value="all">All actors</option>
          {filterOptions.actors.map((actor) => <option key={actor.id} value={actor.id}>{actor.name} · {actor.role}</option>)}
        </Select>
      </div>

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[820px] grid grid-cols-[165px_1.15fr_1fr_1.7fr_90px] p-[11px_16px] uppercase font-bold text-xs"
          style={{ background: C.blueSoft2, color: C.textMute, fontFamily: "Inter, sans-serif" }}
        >
          <div>Timestamp</div><div>Actor</div><div>Client</div><div>Action / Target</div><div>Level</div>
        </div>

        {loading && <EmptyState icon={RefreshCw} text="Loading audit activity..." />}
        {!loading && logs.length === 0 && <EmptyState icon={ScrollText} text="No audit entries match the selected filters." />}

        {!loading && logs.map((log) => (
          <div
            key={log.id}
            className="min-w-[820px] grid grid-cols-[165px_1.15fr_1fr_1.7fr_90px] items-center p-[11px_16px] border-t text-[12.5px]"
            style={{ borderColor: C.border, fontFamily: "Inter, sans-serif" }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: C.textFaint, fontSize: 11.5 }}>{formatTimestamp(log.timestamp)}</div>
            <div className="min-w-0 pr-3">
              <div className="truncate font-semibold" style={{ color: C.text }}>{log.actor?.name || "Unknown actor"}</div>
              <div className="truncate text-[11px]" style={{ color: C.textFaint }}>{log.actor?.email} · {log.actor?.role}</div>
            </div>
            <div className="truncate pr-3" style={{ color: C.textMute }}>{log.client?.name || "Platform-wide"}</div>
            <div className="min-w-0 pr-3" style={{ color: C.textMute }}>
              <strong style={{ color: C.text, fontWeight: 600 }}>{log.action}</strong>
              {log.target ? <span> — {log.target}</span> : null}
            </div>
            <div><Badge text={log.level} tone={levelTone[log.level] || "neutral"} /></div>
          </div>
        ))}
      </Card>

      {!loading && pagination.total > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-sans text-[12px]" style={{ color: C.textFaint }}>
          <span>{pagination.total} event{pagination.total === 1 ? "" : "s"} · Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(value - 1, 1))}>Previous</Btn>
            <Btn variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)}>Next</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
