import { api } from "./http.js";

export const fetchDashboardStatsApi = (clinicId) => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  const query = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return api(`/dashboard/stats?${query}`, { clinicId });
};
