import { api } from "./http.js";

/** -> staff assigned to the active clinic, each with their role AT THAT CLINIC */
export const fetchStaffApi = (clinicId) => api("/staff", { clinicId });

/** -> { staff, emailSent, emailError, temporaryPassword }
 *  The invitation is emailed. temporaryPassword is only returned when the email could NOT be sent. */
export const inviteStaffApi = (clinicId, payload) => api("/staff", { method: "POST", body: payload, clinicId });

/** changes: { role } and/or { status: "active" | "deactivated" } -> updated staff */
export const updateStaffApi = (clinicId, id, changes) => api(`/staff/${id}`, { method: "PATCH", body: changes, clinicId });
