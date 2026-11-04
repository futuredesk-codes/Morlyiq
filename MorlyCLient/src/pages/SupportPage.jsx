import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  LifeBuoy,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Card } from "../components/common/Card";
import { Btn, IconBtn } from "../components/common/Button";
import { Badge, StatusBadge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Field, Input, Select, TextArea } from "../components/common/FormControls";
import { SectionHeader, EmptyState } from "../components/common/Feedback";
import { useApp } from "../store/useApp";
import {
  fetchTicketsApi,
  createTicketApi,
} from "../services/ticketService";

function NewTicketModal({ onClose, onCreate, isSubmitting }) {
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("request");

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!subject.trim() || isSubmitting) return;
    onCreate({
      subject: subject.trim(),
      priority,
      desc: desc.trim(),
      category,
    });
  };

  return (
    <Modal
      title="New support ticket"
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
            {isSubmitting ? "Submitting..." : "Submit ticket"}
          </Btn>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-1">
        <Field label="Subject" hint="Brief summary of your question or issue">
          <Input
            autoFocus
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Verification stuck on MetLife"
            disabled={isSubmitting}
          />
        </Field>
        <Field
          label="Type"
          hint={
            category === "system"
              ? "Visible to everyone at this clinic, so nobody files a duplicate of a known problem"
              : "Visible to you and to your Owner / Manager"
          }
        >
          <Select value={category} onChange={(e) => setCategory(e.target.value)} disabled={isSubmitting}>
            <option value="request">Request — account or practice management</option>
            <option value="system">System issue — outage, timeout or technical error</option>
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={isSubmitting}
          >
            <option value="low">Low — General inquiry or question</option>
            <option value="medium">Medium — Non-critical issue</option>
            <option value="high">High — Blocking urgent operations</option>
          </Select>
        </Field>
        <Field label="Details" hint="Please describe what happened and steps to reproduce">
          <TextArea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Provide all details, patient names, or claim numbers if relevant..."
            rows={4}
            disabled={isSubmitting}
          />
        </Field>
      </form>
    </Modal>
  );
}

// Modal showing ticket details and official admin response (No chat)
function TicketDetailModal({ ticket, onClose }) {
  const priorityTone = { high: "danger", medium: "warn", low: "neutral" };
  const hasResponse = Boolean(ticket.response && ticket.response.trim());

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-textMute bg-slate-100 px-2 py-0.5 rounded font-semibold">
            {ticket.id || ticket.ticketId}
          </span>
          <span className="truncate max-w-[340px] sm:max-w-[420px]">
            {ticket.subject}
          </span>
        </div>
      }
      onClose={onClose}
      width={600}
      footer={
        <Btn variant="outline" size="sm" onClick={onClose}>
          Close
        </Btn>
      }
    >
      <div className="space-y-4">
        {/* Status bar */}
        <div className="bg-[#F8FAFC] border border-brand-border rounded-[10px] p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
          <div className="flex items-center gap-2">
            <span className="text-textMute font-medium">Status:</span>
            <StatusBadge status={ticket.status} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-textMute font-medium">Priority:</span>
            <Badge text={ticket.priority} tone={priorityTone[ticket.priority]} />
          </div>
          <div className="flex items-center gap-1.5 text-textMute">
            <Clock size={13} />
            <span>Updated {ticket.updated || "recently"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-textMute">
            <User size={13} />
            <span>{ticket.createdBy || "Staff"}</span>
          </div>
        </div>

        {/* Your submitted request */}
        <div>
          <h4 className="text-[11.5px] font-bold text-textMute uppercase tracking-wider mb-1.5 font-sans">
            Your Request / Issue Description
          </h4>
          <div className="bg-white border border-brand-border rounded-[10px] p-3.5 text-[13.5px] text-brand-text leading-relaxed whitespace-pre-wrap font-sans">
            {ticket.desc || "No additional description provided."}
          </div>
        </div>

        {/* Official Admin Response Section */}
        <div>
          <h4 className="text-[11.5px] font-bold text-textMute uppercase tracking-wider mb-2 font-sans flex items-center justify-between">
            <span>Response from MorlyIQ Support</span>
            {hasResponse && (
              <span className="inline-flex items-center gap-1 text-brand-success text-[12px] font-semibold lowercase">
                <CheckCircle2 size={13} /> Answered
              </span>
            )}
          </h4>

          {hasResponse ? (
            <div className="bg-[#F0F5FF] border border-[#C8DCFC] rounded-[11px] p-4 font-sans">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center shrink-0">
                    <ShieldCheck size={14} />
                  </div>
                  <span className="font-semibold text-brand-text text-[13px]">
                    {ticket.respondedBy || "MorlyIQ Support Team"}
                  </span>
                </div>
                <span className="text-textFaint text-[11.5px]">
                  {ticket.respondedTimeAgo || "recently"}
                </span>
              </div>
              <div className="text-brand-text text-[13.5px] leading-relaxed whitespace-pre-wrap pt-1 pl-8">
                {ticket.response}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 px-4 bg-slate-50/70 rounded-[10px] border border-dashed border-slate-200 text-textMute text-[13px] font-sans">
              <Clock size={20} className="mx-auto mb-2 text-textFaint" />
              <div className="font-medium text-brand-text text-[13.5px]">
                Awaiting Support Response
              </div>
              <p className="text-textFaint text-[12px] mt-1 max-w-sm mx-auto">
                Our support engineering team has received your ticket and is reviewing it. The official response will appear here once answered.
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default function SupportPage() {
  const { tickets, setTickets, push, clinicId, clinics, currentUser } = useApp();
  const isOwner = Boolean(currentUser?.isOwner); // sees every clinic's tickets at once
  const clinicName = (id) => clinics.find((c) => c.id === id)?.name;
  const [creating, setCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch tickets directly from backend database API
  const loadTickets = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const response = await fetchTicketsApi(clinicId);
        if (response && response.data) {
          setTickets(response.data);
        }
      } catch (err) {
        console.warn("[SupportPage] Failed to fetch tickets from backend:", err.message);
        if (!quiet) {
          push("Unable to load tickets from server", "danger");
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [push, setTickets, clinicId]
  );

  // Global clinic filter: reload (and clear the old clinic's tickets) whenever the clinic changes.
  // The Owner sees all clinics together, so for them a clinic switch changes nothing.
  const scopeKey = isOwner ? "all" : clinicId;
  useEffect(() => {
    setTickets([]);
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, setTickets]);

  // Create ticket handler directly to DB
  async function handleCreateTicket(newTicketData) {
    setIsSubmitting(true);
    try {
      // The server takes the practice, author and clinic from the login, not from the page
      const result = await createTicketApi(clinicId, newTicketData);
      if (result && result.data) {
        setTickets((prev) => [result.data, ...prev]);
        push("Support ticket submitted successfully");
        setCreating(false);
      }
    } catch (err) {
      console.error("[SupportPage] Backend API error:", err.message);
      push(err.message || "Failed to submit ticket to server", "danger");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Filter and search
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "closed"
          ? t.status === "closed" || t.status === "resolved"
          : t.status === statusFilter);

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.subject?.toLowerCase().includes(q) ||
        t.desc?.toLowerCase().includes(q) ||
        t.response?.toLowerCase().includes(q) ||
        t.id?.toLowerCase().includes(q) ||
        t.ticketId?.toLowerCase().includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [tickets, statusFilter, searchQuery]);

  // Tab counts
  const counts = useMemo(
    () => ({
      all: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      pending: tickets.filter((t) => t.status === "pending").length,
      closed: tickets.filter((t) => t.status === "closed" || t.status === "resolved").length,
    }),
    [tickets]
  );

  const priorityTone = { high: "danger", medium: "warn", low: "neutral" };

  return (
    <div>
      <SectionHeader
        title="Support"
        subtitle="Get help from the MorlyIQ dental engineering & support team"
        action={
          <div className="flex items-center gap-2">
            <IconBtn
              icon={RefreshCw}
              title="Refresh tickets"
              onClick={() => loadTickets(false)}
              className={loading ? "animate-spin text-brand-blue" : ""}
            />
            <Btn icon={Plus} onClick={() => setCreating(true)}>
              New ticket
            </Btn>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-[10px] w-fit overflow-x-auto">
          {[
            { key: "all", label: "All", count: counts.all },
            { key: "open", label: "Open", count: counts.open },
            { key: "pending", label: "Pending", count: counts.pending },
            { key: "closed", label: "Closed", count: counts.closed },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[12.5px] font-semibold transition-all ${
                statusFilter === tab.key
                  ? "bg-white text-navy shadow-sm"
                  : "text-textMute hover:text-navy hover:bg-white/50"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10.5px] px-1.5 py-0.2 rounded-full ${
                  statusFilter === tab.key
                    ? "bg-blueSoft text-navy"
                    : "bg-slate-200/70 text-textMute"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-textFaint pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search tickets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-[220px] pl-8 pr-3 py-1.5 bg-white border border-brand-border rounded-[9px] text-[13px] text-brand-text outline-none focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-all"
          />
        </div>
      </div>

      <Card noPad className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[660px]">
            <div className="grid grid-cols-[2.2fr_0.8fr_0.9fr_1fr_0.8fr_40px] px-4 py-[11px] bg-[#F4F7FD] text-[11px] font-bold text-textMute uppercase font-sans">
              <div>Subject</div>
              <div>Priority</div>
              <div>Updated</div>
              <div>Support Response</div>
              <div>Status</div>
              <div className="text-right"></div>
            </div>

            {loading && tickets.length === 0 && (
              <div className="py-12 text-center text-textFaint font-sans text-[13px] flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-brand-blue" />
                <span>Loading tickets from server...</span>
              </div>
            )}

            {!loading && filteredTickets.length === 0 && (
              <EmptyState
                icon={LifeBuoy}
                text={
                  searchQuery || statusFilter !== "all"
                    ? "No tickets match the selected filters."
                    : "No open tickets. Need help? Create a new ticket above."
                }
              />
            )}

            {filteredTickets.map((t) => {
              const hasResponse = Boolean(t.response && t.response.trim());

              return (
                <div
                  key={t.id || t._id}
                  onClick={() => setSelectedTicket(t)}
                  className="grid grid-cols-[2.2fr_0.8fr_0.9fr_1fr_0.8fr_40px] items-center px-4 py-[12px] border-t border-brand-border font-sans text-[13px] hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  {/* Subject & Description snippet */}
                  <div className="pr-3">
                    <div className="text-brand-text font-medium group-hover:text-brand-blue transition-colors truncate">
                      {t.subject}
                      {isOwner && t.clinicId && clinicName(t.clinicId) && (
                        <span className="font-normal text-textFaint"> - {clinicName(t.clinicId)}</span>
                      )}
                    </div>
                    <div className="text-textFaint text-[11.5px] mt-0.5 flex items-center gap-1.5">
                      <span>{t.mine ? "You" : t.createdBy}</span>
                      {t.category === "system" && <Badge text="System issue" tone="blue" />}
                    </div>
                    {t.desc && (
                      <div className="text-textFaint text-[12px] truncate max-w-[280px] mt-0.5">
                        {t.desc}
                      </div>
                    )}
                  </div>

                  {/* Priority */}
                  <div>
                    <Badge text={t.priority} tone={priorityTone[t.priority]} />
                  </div>

                  {/* Updated time */}
                  <div className="text-textFaint text-[12px]">
                    {t.updated || "recently"}
                  </div>

                  {/* Response status */}
                  <div>
                    {hasResponse ? (
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-success bg-successSoft px-2.5 py-1 rounded-full">
                        <CheckCircle2 size={13} />
                        Response ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12px] text-textMute bg-slate-100 px-2.5 py-1 rounded-full">
                        <Clock size={12} />
                        In review
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <StatusBadge status={t.status} />
                  </div>

                  {/* Arrow indicator */}
                  <div className="text-right text-textFaint group-hover:text-brand-blue transition-colors">
                    <ChevronRight size={16} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* New Ticket Modal */}
      {creating && (
        <NewTicketModal
          onClose={() => setCreating(false)}
          onCreate={handleCreateTicket}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Ticket Details & Admin Response View (No chat) */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}
