import React, { useEffect, useMemo, useState } from "react";
import { Calendar, ClipboardList, FileText, Plus, PhoneCall } from "lucide-react";
import { C } from "../constants/theme.js";
import { canAdminDo, LEAD_STATUSES } from "../constants/navigation.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import { StatusBadge, Pill } from "../components/common/Badge.jsx";
import { Modal } from "../components/common/Modal.jsx";
import { Input, Select, TextArea, Field } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { createLeadApi, fetchLeadsApi } from "../services/leadService.js";

const SOURCES = ["Website demo request", "Referral", "Trade show", "Cold outreach", "Other"];

const activityDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
};

export default function LeadsPage() {
  const { currentUser, leads, setLeads, push, logAudit } = useAdmin();
  const canCreate = canAdminDo(currentUser, "leads", "create");
  const [owners, setOwners] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [openedLead, setOpenedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchLeadsApi()
      .then(({ leads: rows, owners: ownerRows }) => {
        if (!active) return;
        setLeads(rows);
        setOwners(ownerRows);
      })
      .catch((error) => {
        if (!active) return;
        setLeads([]);
        setOwners([]);
        push(`Could not load leads: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setLeads]);

  const ownerNames = useMemo(
    () => [...new Set(leads.map((lead) => lead.owner).filter(Boolean))].sort(),
    [leads]
  );

  const filtered = useMemo(
    () =>
      leads.filter(
        (lead) =>
          (statusFilter === "all" || lead.status === statusFilter) &&
          (ownerFilter === "all" || lead.owner === ownerFilter)
      ),
    [leads, ownerFilter, statusFilter]
  );

  async function addLead(value) {
    if (saving || !canCreate) return;
    setSaving(true);
    try {
      const created = await createLeadApi(value);
      setLeads((previous) => [created, ...previous]);
      logAudit("Lead created", created.name, "info", created.name);
      push(`${created.name} added to pipeline`);
      setCreating(false);
    } catch (error) {
      push(`Could not create lead: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Leads & Calling"
        subtitle="Sales pipeline — new practice signups, calls, follow-ups and employee activity"
        action={
          <Btn
            icon={Plus}
            disabled={loading || saving || !canCreate || owners.length === 0}
            title={canCreate ? "Create a new lead" : "Missing leads:create permission"}
            onClick={() => setCreating(true)}
          >
            New lead
          </Btn>
        }
      />

      <div className="flex gap-2.5 mb-3.5 flex-wrap items-center">
        <div className="flex gap-1.5 flex-wrap">
          <Pill
            text="All statuses"
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          {LEAD_STATUSES.map((status) => (
            <Pill
              key={status}
              text={status}
              active={statusFilter === status}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </div>
        <Select
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
          style={{ width: 170 }}
        >
          <option value="all">All owners</option>
          {ownerNames.map((owner) => (
            <option key={owner} value={owner}>{owner}</option>
          ))}
        </Select>
      </div>

      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[750px] grid grid-cols-[1.5fr_1.1fr_1fr_1fr_0.9fr_110px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Lead</div>
          <div>Source</div>
          <div>Owner</div>
          <div>Last activity</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading leads from database...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState icon={PhoneCall} text="No leads match this filter criteria." />
        )}

        {!loading && filtered.map((lead) => (
          <div
            key={lead.id}
            className="min-w-[750px] grid grid-cols-[1.5fr_1.1fr_1fr_1fr_0.9fr_110px] items-center p-[11px_16px] border-t text-[13px]"
            style={{ borderColor: C.border, fontFamily: "Inter, sans-serif" }}
          >
            <div>
              <div style={{ fontWeight: 600, color: C.text }}>{lead.name}</div>
              <div style={{ fontSize: 11.5, color: C.textFaint }}>{lead.contact}</div>
            </div>
            <div style={{ color: C.textMute }}>{lead.source}</div>
            <div style={{ color: C.textMute }}>{lead.owner}</div>
            <div style={{ color: C.textFaint, fontSize: 12 }}>
              {lead.lastActivity?.label || "Lead created"} · {activityDate(lead.lastActivity?.at || lead.createdAt)}
            </div>
            <div><StatusBadge status={lead.status} /></div>
            <div>
              <Btn
                size="sm"
                variant="outline"
                title="Open lead details"
                onClick={() => setOpenedLead(lead)}
              >
                Open
              </Btn>
            </div>
          </div>
        ))}
      </Card>

      {creating && (
        <CreateLeadModal
          owners={owners}
          saving={saving}
          onClose={() => setCreating(false)}
          onCreate={addLead}
        />
      )}

      {openedLead && (
        <LeadDetailModal
          lead={openedLead}
          onClose={() => setOpenedLead(null)}
        />
      )}
    </div>
  );
}

function LeadDetailModal({ lead, onClose }) {
  const [tab, setTab] = useState("timeline");
  const activityLabel = lead.lastActivity?.label || "Lead created";
  const activityIcon = activityLabel.toLowerCase().includes("follow")
    ? Calendar
    : activityLabel.toLowerCase().includes("call")
      ? PhoneCall
      : activityLabel.toLowerCase().includes("task")
        ? ClipboardList
        : FileText;
  const ActivityIcon = activityIcon;
  const tabs = [
    ["timeline", "Timeline"],
    ["call", "Log call"],
    ["followup", "Add follow-up"],
    ["task", "Add task"],
  ];

  return (
    <Modal
      title={lead.name}
      width={640}
      onClose={onClose}
      footer={<Btn variant="outline" onClick={onClose}>Close</Btn>}
    >
      <div className="flex justify-between items-center gap-3 mb-4 flex-wrap">
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: C.textMute }}>
          {lead.contact || "—"} · {lead.source || "—"} · Owner: {lead.owner || "—"}
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {LEAD_STATUSES.map((status) => (
          <Pill
            key={status}
            text={status}
            active={lead.status === status}
          />
        ))}
      </div>

      <div
        className="flex gap-1 border-b mb-4 overflow-x-auto"
        style={{ borderColor: C.border }}
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="border-0 bg-transparent whitespace-nowrap cursor-pointer"
            style={{
              padding: "8px 15px",
              fontFamily: "Inter, sans-serif",
              fontSize: 12.5,
              fontWeight: 600,
              color: tab === key ? C.navy : C.textMute,
              borderBottom: tab === key ? `2px solid ${C.blue}` : "2px solid transparent",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div className="flex gap-3 items-start min-h-[105px]">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: C.blueSoft }}
          >
            <ActivityIcon size={15} color={C.navy} />
          </div>
          <div>
            <div
              className="text-[13px] font-semibold"
              style={{ color: C.text, fontFamily: "Inter, sans-serif" }}
            >
              {activityLabel}
            </div>
            <div
              className="text-[12.5px] mt-0.5"
              style={{ color: C.textMute, fontFamily: "Inter, sans-serif" }}
            >
              Latest activity for this lead.
            </div>
            <div
              className="text-[11.5px] mt-0.5"
              style={{ color: C.textFaint, fontFamily: "Inter, sans-serif" }}
            >
              {activityDate(lead.lastActivity?.at || lead.createdAt)}
            </div>
          </div>
        </div>
      )}

      {tab === "call" && (
        <div className="min-h-[105px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Field label="Outcome">
              <Select disabled defaultValue="Interested">
                <option>Interested</option>
              </Select>
            </Field>
            <Field label="Duration (minutes)">
              <Input disabled type="number" value="10" readOnly />
            </Field>
          </div>
          <Field label="Notes">
            <TextArea disabled value="" readOnly placeholder="What was discussed?" />
          </Field>
          <Btn disabled icon={PhoneCall} title="Call logging will be connected in the next phase">
            Save call log
          </Btn>
        </div>
      )}

      {tab === "followup" && (
        <div className="min-h-[105px]">
          <Field label="Follow-up date">
            <Input disabled type="date" value="" readOnly />
          </Field>
          <Field label="Notes">
            <TextArea disabled value="" readOnly placeholder="What's the next action?" />
          </Field>
          <Btn disabled icon={Calendar} title="Follow-ups will be connected in the next phase">
            Save follow-up
          </Btn>
        </div>
      )}

      {tab === "task" && (
        <div className="min-h-[105px]">
          <Field label="Task">
            <TextArea disabled value="" readOnly placeholder="e.g. Send proposal, schedule onboarding call..." />
          </Field>
          <Btn disabled icon={ClipboardList} title="Tasks will be connected in the next phase">
            Save task
          </Btn>
        </div>
      )}
    </Modal>
  );
}

function CreateLeadModal({ owners, saving, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [ownerId, setOwnerId] = useState(owners[0]?.id || "");
  const valid = name.trim() && contact.trim() && source.trim() && ownerId;

  return (
    <Modal
      title="New lead"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" disabled={saving} onClick={onClose}>Cancel</Btn>
          <Btn
            disabled={saving || !valid}
            onClick={() =>
              onCreate({
                name: name.trim(),
                contact: contact.trim(),
                source,
                ownerId,
              })
            }
          >
            {saving ? "Creating..." : "Create lead"}
          </Btn>
        </>
      }
    >
      <Field label="Practice / lead name">
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Lakeside Dental Studio"
        />
      </Field>
      <Field label="Primary contact">
        <Input
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          placeholder="e.g. Dr. Emily Zhang"
        />
      </Field>
      <Field label="Source">
        <Select value={source} onChange={(event) => setSource(event.target.value)}>
          {SOURCES.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
      </Field>
      <Field label="Owner" hint="Only active Admin Panel users can own new leads.">
        <Select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
          {owners.map((owner) => (
            <option key={owner.id} value={owner.id}>
              {owner.name} — {owner.role}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}
