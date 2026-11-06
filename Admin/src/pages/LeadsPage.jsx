import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, PhoneCall } from "lucide-react";
import { LeadDetailModal } from "../components/leads/LeadDetailModal.jsx";
import { C } from "../constants/theme.js";
import { canAdminDo, LEAD_STATUSES } from "../constants/navigation.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn } from "../components/common/Button.jsx";
import { StatusBadge, Pill } from "../components/common/Badge.jsx";
import { Modal } from "../components/common/Modal.jsx";
import { Input, Select, Field } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { createLeadApi, fetchLeadApi, fetchLeadsApi } from "../services/leadService.js";

const SOURCES = ["Website demo request", "Referral", "Trade show", "Cold outreach", "Other"];

const activityDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, 10);
};

export default function LeadsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedLeadId = searchParams.get("leadId");
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
    if (!requestedLeadId) return undefined;
    let active = true;
    fetchLeadApi(requestedLeadId).then((lead) => { if (active) setOpenedLead(lead); })
      .catch((error) => { if (active) push(error.message, "danger"); });
    return () => { active = false; };
  }, [requestedLeadId, push]);

  function closeLead() {
    setOpenedLead(null);
    if (requestedLeadId) setSearchParams((previous) => { const next = new URLSearchParams(previous); next.delete("leadId"); return next; }, { replace: true });
  }

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
              {lead.phone && <div className="text-xs mt-1" style={{ color: C.textMute }}>{lead.phone}</div>}
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
          onUpdate={(updated) => {
            setOpenedLead(updated);
            setLeads((previous) => previous.map((lead) => lead.id === updated.id ? updated : lead));
          }}
          onClose={closeLead}
        />
      )}
    </div>
  );
}

function CreateLeadModal({ owners, saving, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [ownerId, setOwnerId] = useState(owners[0]?.id || "");
  const valid = name.trim() && contact.trim() && source.trim() && ownerId
    && (!phone.trim() || /^\+?\d{7,15}$/.test(phone.trim().replace(/[\s().-]/g, "")));

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
                phone: phone.trim(),
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
      <Field label="Contact phone number (optional)" hint="Include the country code to call from the lead details.">
        <Input type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 303 555 0123" />
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
