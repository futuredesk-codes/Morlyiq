import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Send,
  CheckCircle2,
  LifeBuoy,
  RefreshCw,
  Plus,
  Trash2,
  Clock,
  User,
  Building2,
  RotateCcw,
  Search,
  MessageSquare,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { C } from "../constants/theme.js";
import { Card, SectionHeader, EmptyState } from "../components/common/Card.jsx";
import { Btn, IconBtn } from "../components/common/Button.jsx";
import { Badge, StatusBadge, Pill } from "../components/common/Badge.jsx";
import { Modal, ConfirmDialog } from "../components/common/Modal.jsx";
import { TextArea, Field, Input, Select } from "../components/common/FormControls.jsx";
import { useAdmin } from "../store/useAdmin.js";
import {
  fetchTicketsApi,
  createTicketApi,
  updateTicketStatusApi,
  addTicketReplyApi,
  deleteTicketApi,
} from "../services/ticketService.js";

// Modal to create a new ticket from Admin
function NewTicketModal({ clients = [], onClose, onCreate, isSubmitting }) {
  const [client, setClient] = useState(clients[0]?.name || "Bright Smiles Dental");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [desc, setDesc] = useState("");

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!subject.trim() || isSubmitting) return;
    onCreate({
      client,
      subject: subject.trim(),
      priority,
      desc: desc.trim(),
    });
  };

  return (
    <Modal
      title="Create Support Ticket"
      onClose={onClose}
      footer={
        <>
          <Btn variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          <Btn
            disabled={!subject.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Creating..." : "Create Ticket"}
          </Btn>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <Field label="Client Organization">
          <Select
            value={client}
            onChange={(e) => setClient(e.target.value)}
            disabled={isSubmitting}
          >
            {clients.map((c) => (
              <option key={c.id || c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Subject" hint="Brief summary of the issue or support request">
          <Input
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Clearinghouse 837 claim batch rejection"
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="low">Low — General inquiry</option>
            <option value="medium">Medium — Standard ticket</option>
            <option value="high">High — Urgent issue / blocking</option>
          </Select>
        </Field>

        <Field label="Issue Details" hint="Include specifics, patient context, or error codes">
          <TextArea
            rows={4}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Provide all known details for this issue..."
            disabled={isSubmitting}
          />
        </Field>
      </form>
    </Modal>
  );
}

// Modal for Admin to write and send an official response to the client
function ReplyTicketModal({ ticket, onClose, onSend, isSubmitting }) {
  const [response, setResponse] = useState(ticket.response || "");
  const [newStatus, setNewStatus] = useState(
    ticket.status === "closed" ? "closed" : "closed"
  );

  const priorityTone = { high: "danger", medium: "warn", low: "neutral" };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!response.trim() || isSubmitting) return;
    onSend(ticket, response.trim(), newStatus);
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <span
            className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
            style={{ background: C.blueSoft, color: C.navy }}
          >
            {ticket.id || ticket.ticketId}
          </span>
          <span className="truncate max-w-[340px] sm:max-w-[420px]" style={{ color: C.text }}>
            Reply to: {ticket.subject}
          </span>
        </div>
      }
      onClose={onClose}
      width={620}
      footer={
        <>
          <Btn variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Btn>
          <Btn
            icon={Send}
            disabled={!response.trim() || isSubmitting}
            onClick={handleSend}
          >
            {isSubmitting ? "Sending..." : "Send Response to Client"}
          </Btn>
        </>
      }
    >
      <form onSubmit={handleSend} className="space-y-4">
        {/* Ticket summary header */}
        <div
          className="border rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{ background: C.bg, borderColor: C.border, fontFamily: "Inter, sans-serif" }}
        >
          <div className="flex items-center gap-1.5">
            <span style={{ color: C.textMute }}>Client:</span>
            <strong className="flex items-center gap-1" style={{ color: C.text }}>
              <Building2 size={13} color={C.blue} />
              {ticket.client}
            </strong>
          </div>

          <div className="flex items-center gap-1.5">
            <span style={{ color: C.textMute }}>Priority:</span>
            <Badge text={ticket.priority} tone={priorityTone[ticket.priority]} />
          </div>

          <div className="flex items-center gap-1.5">
            <span style={{ color: C.textMute }}>Submitted by:</span>
            <span style={{ color: C.text }}>{ticket.createdBy || "Staff"}</span>
          </div>

          <div className="flex items-center gap-1.5" style={{ color: C.textFaint }}>
            <Clock size={13} />
            <span>{ticket.updated || "recently"}</span>
          </div>
        </div>

        {/* Client's Request / Issue */}
        <div>
          <div
            className="text-[11.5px] font-bold uppercase tracking-wider mb-1.5"
            style={{ color: C.textMute, fontFamily: "Inter, sans-serif" }}
          >
            Client's Issue / Request
          </div>
          <div
            className="border rounded-xl p-3.5 text-[13.5px] leading-relaxed whitespace-pre-wrap"
            style={{
              background: "#fff",
              borderColor: C.border,
              color: C.text,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {ticket.desc || "No additional description provided."}
          </div>
        </div>

        {/* Admin's Response input */}
        <div>
          <Field
            label="Official Response to Client"
            hint="This response will be immediately visible to the client in their MorlyIQ portal."
          >
            <TextArea
              autoFocus
              rows={5}
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Explain the resolution, steps taken, or instructions for the client..."
              disabled={isSubmitting}
            />
          </Field>
        </div>

        {/* Status transition */}
        <Field label="Set Ticket Status">
          <Select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="closed">Closed / Resolved (Resolution complete)</option>
            <option value="pending">Pending (Waiting for client verification)</option>
            <option value="open">Open (Keep ticket actively open)</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

export default function TicketsPage() {
  const { tickets, setTickets, clients, push, logAudit, currentUser } = useAdmin();

  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [respondingTicket, setRespondingTicket] = useState(null);
  const [creating, setCreating] = useState(false);
  const [deletingTicket, setDeletingTicket] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync tickets directly with backend database API
  const loadTickets = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await fetchTicketsApi();
        if (res && res.data) {
          setTickets(res.data);
        }
      } catch (err) {
        console.warn("[TicketsPage] Failed to fetch tickets from backend:", err.message);
        if (!quiet) {
          push("Unable to load tickets from server", "danger");
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [push, setTickets]
  );

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Status toggle handler
  const setStatus = async (ticket, status) => {
    const targetId = ticket.id || ticket.ticketId;
    try {
      const res = await updateTicketStatusApi(targetId, status);
      const updated = res?.data;

      setTickets((prev) =>
        prev.map((x) =>
          x.id === targetId || x._id === targetId
            ? { ...(updated || x), status, updated: "just now" }
            : x
        )
      );

      logAudit("Ticket status changed", `${ticket.subject} → ${status}`, "info", ticket.client);
      push(`Ticket "${ticket.subject}" marked ${status}`);
    } catch (err) {
      console.error("[TicketsPage] Failed to update ticket status via API:", err.message);
      push(err.message || "Failed to update status on server", "danger");
    }
  };

  // Response handler (Admin responds to client)
  const handleSendResponse = async (ticket, responseText, newStatus = "closed") => {
    setIsSubmitting(true);
    const targetId = ticket.id || ticket.ticketId;
    const sender = `${currentUser?.name || "Support Specialist"} (MorlyIQ Support)`;

    try {
      const res = await addTicketReplyApi(targetId, {
        response: responseText,
        sender,
        status: newStatus,
      });

      const updated = res?.data;

      setTickets((prev) =>
        prev.map((x) =>
          x.id === targetId || x._id === targetId
            ? {
                ...(updated || x),
                response: responseText,
                respondedBy: sender,
                respondedAt: new Date(),
                respondedTimeAgo: "just now",
                status: newStatus,
                updated: "just now",
              }
            : x
        )
      );

      logAudit("Ticket response sent", ticket.subject, "info", ticket.client);
      push(`Response sent to ${ticket.client}`);
      setRespondingTicket(null);
    } catch (err) {
      console.error("[TicketsPage] Failed to send response via API:", err.message);
      push(err.message || "Failed to send response to server", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create ticket handler directly in database
  const handleCreateTicket = async (ticketData) => {
    setIsSubmitting(true);
    const payload = {
      ...ticketData,
      createdBy: `${currentUser?.name || "Support Admin"} (Admin)`,
    };

    try {
      const res = await createTicketApi(payload);
      if (res && res.data) {
        setTickets((prev) => [res.data, ...prev]);
        logAudit("Ticket created", payload.subject, "info", payload.client);
        push(`Ticket created for ${payload.client}`);
        setCreating(false);
      }
    } catch (err) {
      console.error("[TicketsPage] Create ticket API error:", err.message);
      push(err.message || "Failed to create ticket on server", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete ticket handler directly from database
  const handleDeleteTicket = async () => {
    if (!deletingTicket) return;
    const targetId = deletingTicket.id || deletingTicket.ticketId;

    try {
      await deleteTicketApi(targetId);
      setTickets((prev) => prev.filter((t) => t.id !== targetId && t._id !== targetId));
      logAudit("Ticket deleted", deletingTicket.subject, "warn", deletingTicket.client);
      push(`Ticket "${deletingTicket.subject}" deleted`, "danger");
    } catch (err) {
      console.error("[TicketsPage] Delete API error:", err.message);
      push(err.message || "Failed to delete ticket from server", "danger");
    } finally {
      setDeletingTicket(null);
    }
  };

  // Unique client names for client filter based on real tickets
  const clientOptions = useMemo(() => {
    const set = new Set();
    tickets.forEach((t) => {
      if (t.client) set.add(t.client);
    });
    return Array.from(set).sort();
  }, [tickets]);

  // Dynamic status tab counts
  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      pending: tickets.filter((t) => t.status === "pending").length,
      closed: tickets.filter((t) => t.status === "closed" || t.status === "resolved").length,
    }),
    [tickets]
  );

  // Dynamic priority counts
  const priorityCounts = useMemo(
    () => ({
      all: tickets.length,
      high: tickets.filter((t) => t.priority === "high").length,
      medium: tickets.filter((t) => t.priority === "medium").length,
      low: tickets.filter((t) => t.priority === "low").length,
    }),
    [tickets]
  );

  // Filtered tickets
  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "closed"
          ? t.status === "closed" || t.status === "resolved"
          : t.status === statusFilter);

      const matchClient =
        clientFilter === "all" || t.client === clientFilter;

      const matchPriority =
        priorityFilter === "all" || t.priority === priorityFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.subject?.toLowerCase().includes(q) ||
        t.client?.toLowerCase().includes(q) ||
        t.desc?.toLowerCase().includes(q) ||
        t.response?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.ticketId?.toLowerCase().includes(q);

      return matchStatus && matchClient && matchPriority && matchSearch;
    });
  }, [tickets, statusFilter, clientFilter, priorityFilter, searchQuery]);

  const priorityTone = { high: "danger", medium: "warn", low: "neutral" };

  return (
    <div>
      <SectionHeader
        title="Support Tickets"
        subtitle={`${counts.open} open across all clients • ${tickets.length} total tickets`}
        action={
          <div className="flex items-center gap-2">
            <IconBtn
              icon={RefreshCw}
              title="Refresh tickets from backend"
              onClick={() => loadTickets(false)}
              className={loading ? "animate-spin" : ""}
            />
            <Btn icon={Plus} onClick={() => setCreating(true)}>
              New Ticket
            </Btn>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        {/* Status Filter Pills */}
        <div className="flex gap-2 flex-wrap items-center">
          {[
            { key: "all", label: "all", count: counts.all },
            { key: "open", label: "open", count: counts.open },
            { key: "pending", label: "pending", count: counts.pending },
            { key: "closed", label: "closed", count: counts.closed },
          ].map((s) => (
            <Pill
              key={s.key}
              text={`${s.label} (${s.count})`}
              active={statusFilter === s.key}
              onClick={() => setStatusFilter(s.key)}
            />
          ))}
        </div>

        {/* Client filter, Priority filter & Search input */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Client filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs outline-none bg-white font-medium cursor-pointer"
            style={{
              borderColor: C.border,
              color: C.text,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <option value="all">All Clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border text-xs outline-none bg-white font-medium cursor-pointer"
            style={{
              borderColor: C.border,
              color: C.text,
              fontFamily: "Inter, sans-serif",
            }}
          >
            <option value="all">All Priorities ({priorityCounts.all})</option>
            <option value="high">High Priority ({priorityCounts.high})</option>
            <option value="medium">Medium Priority ({priorityCounts.medium})</option>
            <option value="low">Low Priority ({priorityCounts.low})</option>
          </select>

          {/* Search box */}
          <div className="relative w-full sm:w-[200px]">
            <Search
              size={14}
              color={C.textFaint}
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border rounded-lg text-xs outline-none transition-all"
              style={{
                borderColor: C.border,
                color: C.text,
                fontFamily: "Inter, sans-serif",
              }}
            />
          </div>
        </div>
      </div>

      {/* Tickets Table */}
      <Card noPad className="overflow-x-auto">
        <div
          className="min-w-[780px] grid grid-cols-[1.8fr_1.1fr_0.7fr_0.8fr_1.1fr_0.7fr_140px] p-[11px_16px] uppercase font-bold text-xs"
          style={{
            background: C.blueSoft2,
            color: C.textMute,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <div>Subject</div>
          <div>Client</div>
          <div>Priority</div>
          <div>Updated</div>
          <div>Client Response</div>
          <div>Status</div>
          <div className="text-right">Actions</div>
        </div>

        {loading && tickets.length === 0 && (
          <div
            className="py-12 text-center text-xs flex items-center justify-center gap-2"
            style={{ color: C.textFaint, fontFamily: "Inter, sans-serif" }}
          >
            <RefreshCw size={15} className="animate-spin" color={C.blue} />
            <span>Loading tickets from backend server...</span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={LifeBuoy}
            text={
              searchQuery || statusFilter !== "all" || clientFilter !== "all" || priorityFilter !== "all"
                ? "No tickets match your filter criteria."
                : "No support tickets found across clients."
            }
          />
        )}

        {filtered.map((t) => {
          const hasResponse = Boolean(t.response && t.response.trim());

          return (
            <div
              key={t.id || t._id}
              onClick={() => setRespondingTicket(t)}
              className="min-w-[780px] grid grid-cols-[1.8fr_1.1fr_0.7fr_0.8fr_1.1fr_0.7fr_140px] items-center p-[11px_16px] border-t text-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group"
              style={{
                borderColor: C.border,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {/* Subject & snippet */}
              <div className="pr-2">
                <div
                  className="font-medium group-hover:text-brand-blue transition-colors truncate max-w-[260px]"
                  style={{ color: C.text }}
                >
                  {t.subject}
                </div>
                {t.desc && (
                  <div
                    className="text-[11.5px] truncate max-w-[260px] mt-0.5"
                    style={{ color: C.textFaint }}
                  >
                    {t.desc}
                  </div>
                )}
              </div>

              {/* Client */}
              <div className="truncate pr-2 font-medium" style={{ color: C.textMute }}>
                {t.client}
              </div>

              {/* Priority */}
              <div>
                <Badge text={t.priority} tone={priorityTone[t.priority]} />
              </div>

              {/* Updated timestamp */}
              <div style={{ color: C.textFaint, fontSize: 12 }}>
                {t.updated || "recently"}
              </div>

              {/* Response status */}
              <div>
                {hasResponse ? (
                  <span
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: C.successSoft, color: C.success }}
                    title={t.response}
                  >
                    <CheckCircle2 size={12} />
                    Responded
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: C.warnSoft, color: C.warn }}
                  >
                    <Clock size={12} />
                    Needs Response
                  </span>
                )}
              </div>

              {/* Status */}
              <div>
                <StatusBadge status={t.status} />
              </div>

              {/* Actions */}
              <div
                className="flex gap-1 items-center justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <Btn
                  size="sm"
                  variant={hasResponse ? "outline" : "primary"}
                  icon={Send}
                  onClick={() => setRespondingTicket(t)}
                  title={hasResponse ? "Edit Response" : "Respond to Client"}
                >
                  {hasResponse ? "Edit" : "Reply"}
                </Btn>

                {t.status !== "closed" ? (
                  <IconBtn
                    icon={CheckCircle2}
                    tone="success"
                    title="Close ticket"
                    onClick={() => setStatus(t, "closed")}
                  />
                ) : (
                  <IconBtn
                    icon={RotateCcw}
                    title="Reopen ticket"
                    onClick={() => setStatus(t, "open")}
                  />
                )}

                <IconBtn
                  icon={Trash2}
                  tone="danger"
                  title="Delete ticket"
                  onClick={() => setDeletingTicket(t)}
                />
              </div>
            </div>
          );
        })}
      </Card>

      {/* Response Modal (Admin replies to client) */}
      {respondingTicket && (
        <ReplyTicketModal
          ticket={respondingTicket}
          onClose={() => setRespondingTicket(null)}
          onSend={handleSendResponse}
          isSubmitting={isSubmitting}
        />
      )}

      {/* New Ticket Modal */}
      {creating && (
        <NewTicketModal
          clients={clients}
          onClose={() => setCreating(false)}
          onCreate={handleCreateTicket}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deletingTicket && (
        <ConfirmDialog
          title="Delete Support Ticket"
          message={`Are you sure you want to permanently delete ticket "${deletingTicket.subject}" for ${deletingTicket.client}? This action cannot be undone.`}
          confirmLabel="Delete Ticket"
          tone="danger"
          onConfirm={handleDeleteTicket}
          onCancel={() => setDeletingTicket(null)}
        />
      )}
    </div>
  );
}
