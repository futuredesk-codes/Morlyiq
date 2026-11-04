import { clearAdminSession, loadAdminSession } from "./session.js";

const API_BASE = import.meta.env.VITE_API_URL;

const authHeaders = (json = false) => ({
  ...(json ? { "Content-Type": "application/json" } : {}),
  ...(loadAdminSession()?.token ? { Authorization: `Bearer ${loadAdminSession().token}` } : {}),
});

const ensureOk = async (res, fallback) => {
  if (res.ok) return;
  const err = await res.json().catch(() => ({}));
  if (res.status === 401) clearAdminSession();
  throw new Error(err.message || `${fallback} (${res.status})`);
};

/**
 * Fetch all tickets from backend API with optional filtering
 */
export async function fetchTicketsApi(params = {}) {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.priority && params.priority !== "all") query.set("priority", params.priority);
  if (params.search) query.set("search", params.search);

  const qs = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}/tickets${qs}`, { headers: authHeaders() });
  await ensureOk(res, "Failed to fetch tickets");
  return res.json();
}

/**
 * Create a new support ticket
 */
export async function createTicketApi(ticketData) {
  const res = await fetch(`${API_BASE}/tickets`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(ticketData),
  });
  await ensureOk(res, "Failed to create ticket");
  return res.json();
}

/**
 * Update ticket status (open, pending, closed, resolved)
 */
export async function updateTicketStatusApi(id, status) {
  const res = await fetch(`${API_BASE}/tickets/${id}/status`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ status }),
  });
  await ensureOk(res, "Failed to update status");
  return res.json();
}

/**
 * Post reply to ticket conversation
 */
export async function addTicketReplyApi(id, replyData) {
  const res = await fetch(`${API_BASE}/tickets/${id}/reply`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(replyData),
  });
  await ensureOk(res, "Failed to add reply");
  return res.json();
}

/**
 * Delete a ticket
 */
export async function deleteTicketApi(id) {
  const res = await fetch(`${API_BASE}/tickets/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await ensureOk(res, "Failed to delete ticket");
  return res.json();
}
