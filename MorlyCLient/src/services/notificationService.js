import { api } from "./http.js";

export const fetchNotificationsApi = (clinicId) =>
  api("/notifications", { clinicId });

export const fetchNotificationContentApi = (clinicId) =>
  api("/notifications/content", { clinicId });

export const markNotificationReadApi = (clinicId, notificationId) =>
  api(`/notifications/${notificationId}/read`, { method: "PATCH", clinicId });

export const markAllNotificationsReadApi = (clinicId) =>
  api("/notifications/read-all", { method: "POST", clinicId });

export const fetchNotificationPreferencesApi = (clinicId) =>
  api("/notifications/preferences/email", { clinicId });

export const updateNotificationPreferencesApi = (clinicId, email) =>
  api("/notifications/preferences/email", { method: "PUT", clinicId, body: { email } });
