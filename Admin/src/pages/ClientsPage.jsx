import React, { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Ban, RotateCcw, Archive, Building2, Copy, Mail } from "lucide-react";
import { C } from "../constants/theme.js";
import { FEATURES, FEATURE_MAP } from "../constants/features.js";
import { STATUS_LABEL } from "../constants/navigation.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { StatusBadge } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import {
  Input,
  Select,
  Field,
  Toggle,
  SearchBox,
} from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import { createClientApi, fetchClientsApi, updateClientApi } from "../services/clientService.js";
import { fetchPlansApi } from "../services/planService.js";

export default function ClientsPage() {
  const { clients, setClients, plans, setPlans, push, logAudit } = useAdmin();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([fetchClientsApi(), fetchPlansApi()])
      .then(([clientRows, planRows]) => {
        if (!active) return;
        setClients(clientRows);
        setPlans(planRows);
      })
      .catch((error) => {
        if (!active) return;
        setClients([]);
        push(`Could not load clients: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [push, setClients, setPlans]);

  const filtered = useMemo(
    () =>
      clients.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) &&
          (statusFilter === "all" || c.status === statusFilter)
      ),
    [clients, query, statusFilter]
  );

  const planName = (id) => plans.find((p) => p.id === id)?.name || "—";

  async function applyStatus(client, status) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateClientApi(client.id, { status });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      logAudit("Client status changed", `${client.name}: ${client.status} → ${status}`, "warn", client.name);
      push(`${client.name} marked ${STATUS_LABEL[status] || status}`);
      setConfirmAction(null);
      if (detail?.id === updated.id) setDetail(updated);
    } catch (error) {
      push(`Could not update client: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(draft) {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateClientApi(draft.id, {
        name: draft.name,
        planId: draft.planId,
        clinics: draft.clinics,
      });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      logAudit("Client details updated", updated.name, "info", updated.name);
      push("Client details updated");
      setEditing(null);
      if (detail?.id === updated.id) setDetail(updated);
    } catch (error) {
      push(`Could not save client: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function toggleEntitlement(client, key) {
    if (saving) return;
    const entitlements = { ...client.entitlements, [key]: !client.entitlements[key] };
    setSaving(true);
    try {
      const updated = await updateClientApi(client.id, { entitlements });
      setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setDetail(updated);
      logAudit("Feature entitlement toggled", `${client.name}: ${FEATURE_MAP[key].name}`, "info", client.name);
    } catch (error) {
      push(`Could not update entitlement: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  async function createClient(newClient) {
    if (saving) return;
    setSaving(true);
    try {
      const created = await createClientApi(newClient);
      setClients((prev) => [created, ...prev]);
      logAudit("Client invited", `${created.name} · ${created.email}`, "info", created.name);
      setInviteResult({ practiceName: created.name, email: created.email, ...(created.invitation || {}) });
      push(
        created.invitation?.emailSent ? `Invitation sent to ${created.email}` : "Client created; copy the invitation link to continue",
        created.invitation?.emailSent ? "success" : "warn"
      );
      setCreating(false);
    } catch (error) {
      push(`Could not create client: ${error.message}`, "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionHeader
        title="Clients"
        subtitle={`${clients.length} tenant practices on the platform`}
        action={
          <Btn icon={Plus} disabled={loading || saving} onClick={() => setCreating(true)}>
            Add client
          </Btn>
        }
      />

      {/* Filter Toolbar */}
      <div className="flex flex-wrap gap-2.5 mb-3.5 items-center">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="Search clients..."
        />
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 170 }}
        >
          <option value="all">All statuses</option>
          <option value="invited">Invited</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="past_due">Past due</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </Select>
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12.5,
            color: C.textFaint,
          }}
        >
          {filtered.length} results
        </div>
      </div>

      {/* Data Table */}
      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[760px] grid grid-cols-[1.5fr_1.1fr_0.9fr_0.9fr_0.9fr_150px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            letterSpacing: "0.3px",
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Practice (tenant)</div>
          <div>Plan</div>
          <div>MRR</div>
          <div>Verifications</div>
          <div>Status</div>
          <div>Actions</div>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm" style={{ color: C.textFaint }}>
            Loading clients from database…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={Building2}
            text="No clients match your search filter."
          />
        )}

        {!loading && filtered.map((c) => (
          <div
            key={c.id}
            className="min-w-[760px] grid grid-cols-[1.5fr_1.1fr_0.9fr_0.9fr_0.9fr_150px] items-center p-[12px_16px] border-t text-[13px]"
            style={{
              borderColor: C.border,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <div>
              <button
                type="button"
                onClick={() => setDetail(c)}
                className="bg-transparent border-none cursor-pointer p-0 text-left"
              >
                <div style={{ fontWeight: 600, color: C.navy }}>{c.name}</div>
                <div style={{ fontSize: 11.5, color: C.textFaint }}>
                  {c.email || `Joined ${c.joined}`} · {c.clinics} clinic(s)
                </div>
              </button>
            </div>
            <div style={{ color: C.textMute }}>{planName(c.planId)}</div>
            <div
              style={{
                color: C.text,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              ${c.mrr.toLocaleString()}
            </div>
            <div style={{ color: C.textMute }}>
              {c.verifications.toLocaleString()}
            </div>
            <div>
              <StatusBadge status={c.status} />
              {c.billing?.paymentStatus && c.status === "invited" && (
                <div style={{ fontSize: 10.5, color: C.textFaint, marginTop: 4, textTransform: "capitalize" }}>
                  Payment: {c.billing.paymentStatus.replace("_", " ")}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <IconBtn
                icon={Pencil}
                title="Edit"
                onClick={() => setEditing(c)}
              />
              {c.status !== "suspended" ? (
                <IconBtn
                  icon={Ban}
                  tone="danger"
                  title="Suspend"
                  onClick={() =>
                    setConfirmAction({ client: c, next: "suspended" })
                  }
                />
              ) : (
                <IconBtn
                  icon={RotateCcw}
                  tone="success"
                  title="Reactivate"
                  onClick={() =>
                    setConfirmAction({ client: c, next: "active" })
                  }
                />
              )}
              {c.status !== "archived" && (
                <IconBtn
                  icon={Archive}
                  title="Archive"
                  onClick={() =>
                    setConfirmAction({ client: c, next: "archived" })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </Card>

      {/* Client Detail Modal with Entitlements */}
      {detail && (
        <Modal
          title={detail.name}
          onClose={() => setDetail(null)}
          width={640}
          footer={
            <Btn variant="outline" onClick={() => setDetail(null)}>
              Close
            </Btn>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4.5">
            <Card style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMute,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Plan
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                }}
              >
                {planName(detail.planId)}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMute,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                MRR
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                }}
              >
                ${detail.mrr.toLocaleString()}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  color: C.textMute,
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Users
              </div>
              <div
                style={{
                  fontSize: 14.5,
                  fontWeight: 700,
                  color: C.text,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                }}
              >
                {detail.users}
              </div>
            </Card>
          </div>

          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: C.text,
              marginBottom: 8,
            }}
          >
            Feature entitlements for this tenant
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2.5">
            {FEATURES.map((f) => (
              <div
                key={f.key}
                className="flex justify-between items-center px-2.5 py-2 rounded-lg"
                style={{ background: C.blueSoft2 }}
              >
                <span
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12.5,
                    color: C.text,
                  }}
                >
                  {f.name}
                </span>
                <Toggle
                  on={!!detail.entitlements[f.key]}
                  disabled={saving}
                  onChange={() => toggleEntitlement(detail, f.key)}
                />
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 11.5,
              color: C.textFaint,
            }}
          >
            Entitlements are stored on the tenant record. Individual feature APIs
            should enforce these flags when those modules are connected.
          </div>
        </Modal>
      )}

      {/* Edit Client Modal */}
      {editing && (
        <Modal
          title={`Edit ${editing.name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <Btn variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Btn>
              <Btn disabled={saving || !editing.name.trim()} onClick={() => saveEdit(editing)}>
                {saving ? "Saving…" : "Save changes"}
              </Btn>
            </>
          }
        >
          <Field label="Practice name">
            <Input
              value={editing.name}
              onChange={(e) =>
                setEditing({ ...editing, name: e.target.value })
              }
            />
          </Field>
          <Field label="Plan">
            <Select
              value={editing.planId}
              onChange={(e) =>
                setEditing({ ...editing, planId: e.target.value })
              }
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Number of clinics">
            <Input
              type="number"
              min={1}
              value={editing.clinics}
              onChange={(e) =>
                setEditing({ ...editing, clinics: Number(e.target.value) })
              }
            />
          </Field>
        </Modal>
      )}

      {/* Create Client Modal */}
      {creating && (
        <CreateClientModal
          plans={plans}
          saving={saving}
          onClose={() => setCreating(false)}
          onCreate={createClient}
        />
      )}

      {inviteResult && (
        <Modal
          title="Client invitation created"
          onClose={() => setInviteResult(null)}
          width={560}
          footer={<Btn onClick={() => setInviteResult(null)}>Done</Btn>}
        >
          <div className="flex gap-3 items-start p-3.5 rounded-[10px] mb-4" style={{ background: inviteResult.emailSent ? C.successSoft : C.warnSoft }}>
            <Mail size={19} style={{ color: inviteResult.emailSent ? C.success : C.warn, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, fontWeight: 700, color: C.text }}>
                {inviteResult.emailSent ? `Invitation emailed to ${inviteResult.email}` : "Email could not be sent"}
              </div>
              <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.textMute, marginTop: 4 }}>
                {inviteResult.emailSent
                  ? "The owner will continue to Stripe test checkout and then create a password."
                  : inviteResult.emailError || "Share the secure link below with the client owner."}
              </div>
            </div>
          </div>
          <Field label="Development invitation link">
            <div className="flex gap-2">
              <Input readOnly value={inviteResult.onboardingUrl || ""} onFocus={(event) => event.target.select()} />
              <Btn
                variant="outline"
                icon={Copy}
                onClick={async () => {
                  await navigator.clipboard.writeText(inviteResult.onboardingUrl || "");
                  push("Invitation link copied");
                }}
              >
                Copy
              </Btn>
            </div>
          </Field>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.textFaint }}>
            The client remains Invited until payment is confirmed and the owner creates a password.
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={`${
            confirmAction.next === "archived"
              ? "Archive"
              : confirmAction.next === "active"
              ? "Reactivate"
              : "Suspend"
          } client?`}
          message={
            confirmAction.next === "archived"
              ? `${confirmAction.client.name} will be archived and hidden from active lists. This can be reversed.`
              : confirmAction.next === "active"
              ? `${confirmAction.client.name} will regain access to MorlyIQ immediately.`
              : `${confirmAction.client.name} will lose access to the platform immediately. Data is retained.`
          }
          confirmLabel={
            confirmAction.next === "archived"
              ? "Archive"
              : confirmAction.next === "active"
              ? "Reactivate"
              : "Suspend"
          }
          tone={confirmAction.next === "active" ? "accent" : "danger"}
          onConfirm={() =>
            applyStatus(confirmAction.client, confirmAction.next)
          }
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

function CreateClientModal({ plans, saving, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const checkoutPlans = plans.filter((plan) => plan.status === "Active" && Number(plan.price) > 0);
  const [planId, setPlanId] = useState(checkoutPlans[0]?.id || "");
  const [clinics, setClinics] = useState(1);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = name.trim() && ownerName.trim() && emailValid && planId && clinics >= 1;

  return (
    <Modal
      title="Add new client"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose}>
            Cancel
          </Btn>
          <Btn
            disabled={saving || !canSubmit}
            onClick={() =>
              onCreate({
                name: name.trim(),
                ownerName: ownerName.trim(),
                email: email.trim().toLowerCase(),
                planId,
                clinics,
              })
            }
          >
            {saving ? "Sending…" : "Send invitation"}
          </Btn>
        </>
      }
    >
      <Field label="Practice name">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lakeside Dental Studio"
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Owner name">
          <Input
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="e.g. Dr. Emily Zhang"
          />
        </Field>
        <Field label="Owner email">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="owner@practice.com"
          />
        </Field>
      </div>
      <Field label="Starting plan">
        <Select
          value={planId}
          onChange={(e) => setPlanId(e.target.value)}
        >
          <option value="" disabled>Select a checkout-ready plan</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id} disabled={p.status !== "Active" || !(Number(p.price) > 0)}>
              {p.name}{Number(p.price) > 0 && p.status === "Active" ? ` — $${p.price} / ${p.period}` : " — unavailable for checkout"}
            </option>
          ))}
        </Select>
        {!checkoutPlans.length && (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11.5, color: C.danger, marginTop: 5 }}>
            Create an active plan with a price greater than $0 before inviting a client.
          </div>
        )}
      </Field>
      <Field label="Number of clinics">
        <Input
          type="number"
          min={1}
          value={clinics}
          onChange={(e) => setClinics(Number(e.target.value))}
        />
      </Field>
    </Modal>
  );
}
