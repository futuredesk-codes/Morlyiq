import { api } from "./http.js";

// The Support page reads `response.data`, so both calls resolve to { data }.

/** Tickets the signed-in role may see at the active clinic (Owner / Manager: all of them; others: their own + system-wide issues) */
export async function fetchTicketsApi(clinicId, params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.priority && params.priority !== "all") query.set("priority", params.priority);
  if (params.search) query.set("search", params.search);
  const qs = query.toString() ? `?${query.toString()}` : "";
  return { data: await api(`/tickets${qs}`, { clinicId }) };
}

/** Create a ticket at the active clinic. ticketData: { subject, priority, desc, category: "system" | "request" } */
export async function createTicketApi(clinicId, ticketData) {
  return { data: await api("/tickets", { method: "POST", body: ticketData, clinicId }) };
}
