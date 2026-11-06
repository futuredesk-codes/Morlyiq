import React, { useEffect, useRef, useState } from "react";
import { Calendar, ClipboardList, PhoneCall, CheckCircle2, RefreshCw } from "lucide-react";
import { Modal } from "../common/Modal.jsx";
import { Btn } from "../common/Button.jsx";
import { Field, Input, Select, TextArea } from "../common/FormControls.jsx";
import { StatusBadge } from "../common/Badge.jsx";
import { C } from "../../constants/theme.js";
import { canAdminDo, LEAD_STATUSES } from "../../constants/navigation.js";
import { useAdmin } from "../../store/useAdmin.js";
import { fetchLeadApi, updateLeadApi, addLeadActivityApi, completeLeadActivityApi } from "../../services/leadService.js";

const OUTCOMES = ["Interested", "Not interested", "No answer", "Voicemail", "Busy", "Wrong number", "Connected"];
const dateTime = (value) => value ? new Date(value).toLocaleString() : "";
const normalizePhone = (value) => value.trim().replace(/[\s().-]/g, "");
const validPhone = (value) => !value || /^\+?\d{7,15}$/.test(normalizePhone(value));

export function LeadDetailModal({ lead: initialLead, onClose, onUpdate }) {
  const { currentUser, push } = useAdmin();
  const [lead, setLead] = useState(initialLead);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("timeline");
  const [phone, setPhone] = useState(initialLead.phone || "");
  const [outcome, setOutcome] = useState(OUTCOMES[0]);
  const [duration, setDuration] = useState("0");
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const inFlight = useRef(false);
  const can = (resource, action) => canAdminDo(currentUser, resource, action);
  const canEdit = can("leads", "edit");

  useEffect(() => {
    let active = true;
    fetchLeadApi(initialLead.id).then((value) => {
      if (active) { setLead(value); setPhone(value.phone); }
    }).catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialLead.id]);

  async function mutate(action, message, clear = false) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const updated = await action();
      setLead(updated);
      setPhone(updated.phone);
      onUpdate(updated);
      push(message);
      if (clear) { setNotes(""); setTitle(""); setDueAt(""); setDuration("0"); setTab("timeline"); }
    } catch (error) { push(error.message, "danger"); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function saveActivity(event) {
    event.preventDefault();
    const payload = tab === "call"
      ? { type: tab, outcome, durationMinutes: Number(duration), notes: notes.trim() }
      : { type: tab, title: title.trim(), notes: notes.trim(), dueAt: dueAt ? new Date(dueAt).toISOString() : null };
    await mutate(() => addLeadActivityApi(lead.id, payload), tab === "call" ? "Call log saved" : tab === "followup" ? "Follow-up scheduled" : "Task saved", true);
  }

  const tabs = [["timeline", "Timeline"], ...(can("calls", "create") ? [["call", "Log call"]] : []),
    ...(can("tasks", "create") ? [["followup", "Add follow-up"], ["task", "Add task"]] : [])];
  const entries = [...(lead.activities || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
  const openItems = entries.filter((entry) => ["task", "followup"].includes(entry.type) && !entry.completedAt);
  const activityValid = tab === "call" ? duration !== "" && Number(duration) >= 0 && Number(duration) <= 1440
    : Boolean(title.trim() && (tab !== "followup" || dueAt) && (!dueAt || new Date(dueAt) > new Date()));

  return (
    <Modal title={lead.name} width={760} onClose={busy ? undefined : onClose} footer={<Btn variant="outline" disabled={busy} onClick={onClose}>Close</Btn>}>
      <div className="flex justify-between items-start gap-3 mb-4 flex-wrap">
        <div className="text-sm" style={{ color: C.textMute }}>{lead.contact} · {lead.source}<div className="text-xs mt-1">Owner: {lead.owner}</div></div>
        <StatusBadge status={lead.status} />
      </div>
      {loading ? <p role="status">Loading lead details...</p> : loadError ? <p role="alert" style={{ color: C.danger }}>{loadError} Close and reopen this lead to retry.</p> : <>
        <div className="flex gap-1.5 mb-5 flex-wrap" aria-label="Lead status">
          {LEAD_STATUSES.map((status) => <Btn key={status} size="sm" variant={lead.status === status ? "primary" : "outline"}
            disabled={busy || !canEdit || lead.status === status} title={canEdit ? `Change status to ${status}` : "Requires leads:edit"}
            onClick={() => mutate(() => updateLeadApi(lead.id, { status }), "Lead status updated")}>{status}</Btn>)}
        </div>
        <div className="rounded-xl border p-3 mb-5" style={{ borderColor: C.border }}>
          <Field label="Contact phone number" hint="Include the country code, e.g. +1 303 555 0123.">
            <Input type="tel" value={phone} maxLength={40} disabled={busy || !canEdit} onChange={(event) => setPhone(event.target.value)} placeholder="+1 303 555 0123" />
          </Field>
          <div className="flex flex-wrap gap-2 items-center">
            {canEdit && <Btn size="sm" variant="outline" disabled={busy || !validPhone(phone) || normalizePhone(phone) === lead.phone}
              onClick={() => mutate(() => updateLeadApi(lead.id, { phone }), "Contact number saved")}>Save number</Btn>}
            {can("calls", "create") && <Btn size="sm" icon={PhoneCall} disabled={busy || !lead.phone || normalizePhone(phone) !== lead.phone} title={lead.phone ? "Open your phone or calling app" : "Save a phone number first"}
              onClick={() => { window.location.href = `tel:${lead.phone}`; setTab("call"); }}>Call {lead.phone || "lead"}</Btn>}
            <span className="text-xs" style={{ color: C.textFaint }}>Opens your dialer. Save the outcome after your call.</span>
          </div>
          {!validPhone(phone) && <p role="alert" className="text-xs mt-2" style={{ color: C.danger }}>Enter 7–15 digits with an optional + country code.</p>}
          {normalizePhone(phone) !== lead.phone && <p className="text-xs mt-2" style={{ color: C.textMute }}>Save the number before calling.</p>}
        </div>
        <div className="flex gap-2 mb-4 overflow-x-auto border-b pb-3" style={{ borderColor: C.border }}>
          {tabs.map(([key, label]) => <Btn key={key} size="sm" variant={tab === key ? "primary" : "ghost"} disabled={busy}
            onClick={() => { setTab(key); setNotes(""); setTitle(""); setDueAt(""); }}>{label}</Btn>)}
        </div>
        {tab === "timeline" ? <>
          <div className="flex justify-between items-center mb-3"><strong className="text-sm">Activity timeline</strong>
            <Btn size="sm" icon={RefreshCw} variant="ghost" disabled={busy} onClick={() => mutate(() => fetchLeadApi(lead.id), "Lead refreshed")}>Refresh</Btn></div>
          {openItems.length > 0 && <div className="rounded-lg p-3 mb-4" style={{ background: C.blueSoft2 }}>
            <div className="font-semibold text-sm mb-2">Upcoming & overdue ({openItems.length})</div>
            {[...openItems].sort((a, b) => (a.dueAt ? new Date(a.dueAt).getTime() : Infinity) - (b.dueAt ? new Date(b.dueAt).getTime() : Infinity)).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <div className="text-sm">{entry.title}<div className="text-xs mt-1" style={{ color: entry.dueAt && new Date(entry.dueAt) < new Date() ? C.danger : C.textMute }}>
                  {entry.type === "followup" ? "Follow-up" : "Task"}{entry.dueAt ? ` · ${dateTime(entry.dueAt)}` : " · No due date"}</div></div>
                {can("tasks", "view") && (can("tasks", "edit") || can("tasks", "execute")) && <Btn icon={CheckCircle2} size="sm" variant="outline" disabled={busy}
                  onClick={() => mutate(() => completeLeadActivityApi(lead.id, entry.id), "Activity completed")}>Complete</Btn>}
              </div>
            ))}
          </div>}
          {!entries.length && <p className="text-sm" style={{ color: C.textMute }}>Lead created · {dateTime(lead.createdAt)}. No activities recorded yet.</p>}
          <div className="space-y-3">{entries.map((entry) => <article key={entry.id} className="border rounded-xl p-3" style={{ borderColor: C.border }}>
            <div className="flex justify-between gap-2 text-sm font-semibold"><span>{entry.title}</span>{entry.completedAt && <span style={{ color: C.success }}>Completed</span>}</div>
            {entry.type === "call" && <div className="text-xs mt-1">{entry.durationMinutes} minutes · {entry.outcome}</div>}
            {entry.notes && <p className="text-sm whitespace-pre-wrap break-words mt-2">{entry.notes}</p>}
            {entry.dueAt && <div className="text-xs mt-2">Due: {dateTime(entry.dueAt)}</div>}
            {entry.dueAt && !entry.completedAt && ["task", "followup"].includes(entry.type) && <div className="text-xs mt-1" style={{ color: C.textMute }}>
              Reminder to {lead.owner}: {entry.reminderNotificationSentAt ? "notification sent" : "notification at due time"} · {entry.reminderEmailSentAt ? "email sent" : "email pending"}
            </div>}
            <div className="text-xs mt-2" style={{ color: C.textFaint }}>{entry.actorName} · {dateTime(entry.at)}</div>
          </article>)}</div>
        </> : <form onSubmit={saveActivity}>
          {tab === "call" ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Outcome"><Select value={outcome} disabled={busy} onChange={(e) => setOutcome(e.target.value)}>{OUTCOMES.map((item) => <option key={item}>{item}</option>)}</Select></Field>
            <Field label="Duration (minutes)"><Input type="number" required min="0" max="1440" step="0.1" disabled={busy} value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          </div> : <>
            <Field label={tab === "followup" ? "Follow-up action" : "Task title"}><Input required maxLength={200} disabled={busy} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Send proposal" /></Field>
            <Field label={`Due date & time${tab === "task" ? " (optional)" : ""}`} hint="Shown in your local timezone."><Input type="datetime-local" required={tab === "followup"} disabled={busy} value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></Field>
            <p className="text-xs mb-4" style={{ color: C.textMute }}>{dueAt
              ? `An in-app notification and email reminder will be sent to ${lead.owner} when due. Delivery may take about a minute; email requires server SMTP.`
              : "Set a due date and time to send an automatic reminder to the lead owner."}</p>
          </>}
          <Field label="Notes"><TextArea maxLength={4000} disabled={busy} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tab === "call" ? "What was discussed?" : "What needs to happen next?"} /></Field>
          <Btn type="submit" disabled={busy || !activityValid} icon={tab === "call" ? PhoneCall : tab === "followup" ? Calendar : ClipboardList}>
            {busy ? "Saving..." : tab === "call" ? "Save call log" : tab === "followup" ? "Save follow-up" : "Save task"}
          </Btn>
        </form>}
      </>}
    </Modal>
  );
}
