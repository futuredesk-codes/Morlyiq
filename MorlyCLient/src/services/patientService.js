import { api } from "./http.js";

/** "Jul 14, 2026 · 9:10 AM" from an ISO date-time (what the Patients list shows) */
export function formatAppt(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}

const toUi = (p) => ({ ...p, appt: formatAppt(p.appointment) });

export const byAppointment = (a, b) =>
  (a.appointment ? new Date(a.appointment).getTime() : Infinity) - (b.appointment ? new Date(b.appointment).getTime() : Infinity);

/** Patients of one clinic, soonest appointment first */
export const fetchPatientsApi = (clinicId) => api("/patients", { clinicId }).then((list) => list.map(toUi));

/** payload: { name, dob, payer, subscriberId, groupNumber?, appointment? (ISO date-time or null) } */
export const createPatientApi = (clinicId, payload) => api("/patients", { method: "POST", body: payload, clinicId }).then(toUi);

/** Import up to 500 pre-mapped CSV/XLSX rows into the active clinic. */
export const importPatientsApi = (clinicId, rows) =>
  api("/patients/import", { method: "POST", body: { rows }, clinicId })
    .then((result) => ({ ...result, patients: (result.patients || []).map(toUi) }));

/** changes: any of status, result, aiSummary, patientSummary, aiReviewed, payer, subscriberId, groupNumber, cob, appointment, dob */
export const updatePatientApi = (clinicId, id, changes) => api(`/patients/${id}`, { method: "PATCH", body: changes, clinicId }).then(toUi);

/** Save a validated secondary payer policy for a patient. */
export const saveSecondaryInsuranceApi = (clinicId, id, payload) =>
  api(`/patients/${id}/secondary-insurance`, { method: "PUT", body: payload, clinicId }).then(toUi);

/** Remove the patient's secondary policy. */
export const removeSecondaryInsuranceApi = (clinicId, id) =>
  api(`/patients/${id}/secondary-insurance`, { method: "DELETE", clinicId }).then(toUi);

/** Run one Stedi eligibility transaction per included insurance policy. */
export const verifyPatientEligibilityApi = (clinicId, id, { includeSecondary = true } = {}) =>
  api(`/patients/${id}/eligibility`, {
    method: "POST",
    body: { includeSecondary },
    clinicId,
  }).then((data) => ({ ...data, patient: toUi(data.patient) }));

/** Record an internal MorlyIQ claim-workflow submission (no external 837D transaction yet). */
export const submitPatientClaimApi = (clinicId, id) =>
  api(`/patients/${id}/claim-submission`, {
    method: "POST",
    clinicId,
  }).then(toUi);
