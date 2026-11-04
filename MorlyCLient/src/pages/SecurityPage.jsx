import React, { useEffect, useState } from "react";
import { Card } from "../components/common/Card";
import { Btn } from "../components/common/Button";
import { Toggle } from "../components/common/FormControls";
import { SectionHeader, Pill } from "../components/common/Feedback";
import { AccountSecurity } from "../components/security/AccountSecurity";
import { useApp } from "../store/useApp";
import { fetchActivityApi, fetchPolicyApi, setPolicyApi } from "../services/accountService";

// "2026-07-20 09:42" in the viewer's local time
const pad = (n) => String(n).padStart(2, "0");
const formatTs = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function RowToggle({ label, desc, on, onChange, disabled }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div>
        <div className="font-sans text-[13.5px] font-semibold text-brand-text">
          {label}
        </div>
        <div className="font-sans text-[12px] text-textMute mt-0.5">
          {desc}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function SecurityPage() {
  const { role, push } = useApp();
  const [tab, setTab] = useState("account");
  const [requireMfaAll, setRequireMfaAll] = useState(false);
  const [policyLoaded, setPolicyLoaded] = useState(false);
  const [activityLog, setActivityLog] = useState(null); // null = loading
  const [hasMore, setHasMore] = useState(false);
  const PAGE = 100;

  // Reload the log each time the Owner opens the tab, so new actions show up
  useEffect(() => {
    if (role !== "Owner" || tab !== "activity") return;
    fetchActivityApi({ limit: PAGE })
      .then((rows) => {
        setActivityLog(rows);
        setHasMore(rows.length === PAGE);
      })
      .catch((err) => push(err.message, "danger"));
  }, [role, tab, push]);

  async function loadMoreActivity() {
    try {
      const rows = await fetchActivityApi({ limit: PAGE, before: activityLog[activityLog.length - 1].ts });
      setActivityLog((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE);
    } catch (err) {
      push(err.message, "danger");
    }
  }

  useEffect(() => {
    if (role !== "Owner") return;
    fetchPolicyApi()
      .then((p) => {
        setRequireMfaAll(p.requireMfa);
        setPolicyLoaded(true);
      })
      .catch((err) => push(err.message, "danger"));
  }, [role, push]);

  async function changeMfaPolicy(v) {
    try {
      const p = await setPolicyApi(v);
      setRequireMfaAll(p.requireMfa);
      push(p.requireMfa ? "MFA is now required for all staff" : "MFA is no longer required", p.requireMfa ? "success" : "warn");
    } catch (err) {
      push(err.message, "danger");
    }
  }

  const tabs = [
    ["account", "Your account"],
    ["policy", "Practice policy"],
    ["activity", "Activity log"],
  ];
  const visibleTabs = tabs
    .filter(([k]) => k !== "policy" || role === "Owner")
    .filter(([k]) => k !== "activity" || role === "Owner");

  return (
    <div>
      <SectionHeader
        title="Security & Settings"
        subtitle="Manage your login security and practice-wide policy"
      />
      <div className="flex gap-1.5 mb-[18px] overflow-x-auto pb-1">
        {visibleTabs.map(([k, label]) => (
          <Pill
            key={k}
            text={label}
            active={tab === k}
            onClick={() => setTab(k)}
          />
        ))}
      </div>

      {tab === "account" && <AccountSecurity />}

      {tab === "policy" && role === "Owner" && (
        <Card>
          <div className="font-sans text-[14px] font-bold text-brand-text mb-3.5">
            Practice-wide security policy
          </div>
          <div className="flex flex-col gap-4">
            <RowToggle
              label="Require MFA for all staff"
              desc="Every staff member must set up multi-factor authentication before their next login."
              on={requireMfaAll}
              disabled={!policyLoaded}
              onChange={changeMfaPolicy}
            />
          </div>
        </Card>
      )}

      {tab === "activity" && role === "Owner" && (
        <Card noPad className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              <div className="grid grid-cols-[150px_1fr_1.3fr] px-4 py-[11px] bg-[#F4F7FD] text-[11px] font-bold text-textMute uppercase font-sans">
                <div>Timestamp</div>
                <div>Staff member</div>
                <div>Action</div>
              </div>
              {activityLog === null && (
                <div className="px-4 py-3 border-t border-brand-border font-sans text-[12.5px] text-textFaint">Loading...</div>
              )}
              {activityLog?.length === 0 && (
                <div className="px-4 py-3 border-t border-brand-border font-sans text-[12.5px] text-textFaint">No activity recorded yet.</div>
              )}
              {(activityLog || []).map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[150px_1fr_1.3fr] px-4 py-2.5 border-t border-brand-border font-sans text-[12.5px] hover:bg-slate-50/70 transition-colors"
                >
                  <div className="font-mono text-textFaint text-[11.5px]">
                    {formatTs(a.ts)}
                  </div>
                  <div className="text-brand-text font-medium">{a.actor}</div>
                  <div className="text-textMute">
                    <strong className="text-brand-text">{a.action}</strong>
                    {a.target && <> — {a.target}</>}
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="px-4 py-3 border-t border-brand-border text-center">
                  <Btn size="sm" variant="outline" onClick={loadMoreActivity}>
                    Load more
                  </Btn>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
