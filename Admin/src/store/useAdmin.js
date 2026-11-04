import { useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  login as loginAction,
  logout as logoutAction,
  setCurrentUser as setCurrentUserAction,
} from "./slices/authSlice.js";
import {
  toggleSidebar as toggleSidebarAction,
  setSidebarOpen as setSidebarOpenAction,
  toggleCollapse as toggleCollapseAction,
  setSidebarCollapsed as setSidebarCollapsedAction,
  addToast,
  removeToast,
} from "./slices/uiSlice.js";
import {
  setTickets as setTicketsAction,
  addTicket as addTicketAction,
  updateTicket as updateTicketAction,
} from "./slices/ticketsSlice.js";
import {
  setClients as setClientsAction,
  setPlans as setPlansAction,
  setCoupons as setCouponsAction,
  setUsers as setUsersAction,
  setRoles as setRolesAction,
  setCatalogue as setCatalogueAction,
  setInsurers as setInsurersAction,
  setCdt as setCdtAction,
  setInvoices as setInvoicesAction,
  setAnnouncements as setAnnouncementsAction,
  setLeads as setLeadsAction,
  setLinks as setLinksAction,
  setAudit as setAuditAction,
} from "./slices/dataSlice.js";
import { nextId } from "../utils/id.js";
import store from "./index.js";
import { loginAdmin, logoutAdmin, resendAdminMfa, verifyAdminMfa } from "../services/authService.js";
import { clearAdminSession, saveAdminSession } from "../services/session.js";
import { createAuditLogApi } from "../services/auditService.js";

/**
 * Unified Redux facade hook for the Admin panel.
 * Replaces the legacy AdminContext.jsx with direct Redux selector/dispatch bindings.
 */
export function useAdmin() {
  const dispatch = useDispatch();

  // Authentication State
  const authed = useSelector((state) => state.auth.authed);
  const currentUser = useSelector((state) => state.auth.currentUser);

  // UI State
  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const sidebarCollapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const toasts = useSelector((state) => state.ui.toasts);

  // Tickets State
  const tickets = useSelector((state) => state.tickets.tickets);

  // Domain Data State
  const clients = useSelector((state) => state.data.clients);
  const plans = useSelector((state) => state.data.plans);
  const coupons = useSelector((state) => state.data.coupons);
  const users = useSelector((state) => state.data.users);
  const roles = useSelector((state) => state.data.roles);
  const catalogue = useSelector((state) => state.data.catalogue);
  const insurers = useSelector((state) => state.data.insurers);
  const cdt = useSelector((state) => state.data.cdt);
  const invoices = useSelector((state) => state.data.invoices);
  const announcements = useSelector((state) => state.data.announcements);
  const leads = useSelector((state) => state.data.leads);
  const links = useSelector((state) => state.data.links);
  const audit = useSelector((state) => state.data.audit);

  // Auth actions
  const login = useCallback(
    async ({ email, password, remember }) => {
      const session = await loginAdmin(email, password);
      if (session.mfaRequired) return session;
      saveAdminSession(session, remember);
      dispatch(loginAction(session));
      return session;
    },
    [dispatch]
  );

  const verifyMfa = useCallback(
    async ({ mfaToken, code, remember }) => {
      const session = await verifyAdminMfa(mfaToken, code);
      saveAdminSession(session, remember);
      dispatch(loginAction(session));
      return session;
    },
    [dispatch]
  );

  const resendMfa = useCallback((mfaToken) => resendAdminMfa(mfaToken), []);

  const logout = useCallback(() => {
    const remoteLogout = logoutAdmin().catch(() => null);
    clearAdminSession();
    dispatch(logoutAction());
    return remoteLogout;
  }, [dispatch]);

  const setCurrentUser = useCallback(
    (userOrFn) => {
      const current = store.getState().auth.currentUser;
      const value = typeof userOrFn === "function" ? userOrFn(current) : userOrFn;
      dispatch(setCurrentUserAction(value));
    },
    [dispatch]
  );

  // UI actions
  const toggleSidebar = useCallback(
    () => dispatch(toggleSidebarAction()),
    [dispatch]
  );

  const setSidebarOpen = useCallback(
    (open) => dispatch(setSidebarOpenAction(open)),
    [dispatch]
  );

  const toggleCollapse = useCallback(
    () => dispatch(toggleCollapseAction()),
    [dispatch]
  );

  const setSidebarCollapsed = useCallback(
    (collapsed) => dispatch(setSidebarCollapsedAction(collapsed)),
    [dispatch]
  );

  // Toast notifications
  const push = useCallback(
    (text, tone = "success") => {
      const id = nextId("toast");
      dispatch(addToast({ id, text, tone }));
      setTimeout(() => {
        dispatch(removeToast(id));
      }, 3200);
    },
    [dispatch]
  );

  // Stable setters supporting both direct values and functional updates
  const setTickets = useCallback(
    (actionOrValue) => {
      const current = store.getState().tickets.tickets;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setTicketsAction(value));
    },
    [dispatch]
  );

  const setClients = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.clients;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setClientsAction(value));
    },
    [dispatch]
  );

  const setPlans = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.plans;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setPlansAction(value));
    },
    [dispatch]
  );

  const setCoupons = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.coupons;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setCouponsAction(value));
    },
    [dispatch]
  );

  const setUsers = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.users;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setUsersAction(value));
    },
    [dispatch]
  );

  const setRoles = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.roles;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setRolesAction(value));
    },
    [dispatch]
  );

  const setCatalogue = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.catalogue;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setCatalogueAction(value));
    },
    [dispatch]
  );

  const setInsurers = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.insurers;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setInsurersAction(value));
    },
    [dispatch]
  );

  const setCdt = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.cdt;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setCdtAction(value));
    },
    [dispatch]
  );

  const setInvoices = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.invoices;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setInvoicesAction(value));
    },
    [dispatch]
  );

  const setAnnouncements = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.announcements;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setAnnouncementsAction(value));
    },
    [dispatch]
  );

  const setLeads = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.leads;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setLeadsAction(value));
    },
    [dispatch]
  );

  const setLinks = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.links;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setLinksAction(value));
    },
    [dispatch]
  );

  const setAudit = useCallback(
    (actionOrValue) => {
      const current = store.getState().data.audit;
      const value = typeof actionOrValue === "function" ? actionOrValue(current) : actionOrValue;
      dispatch(setAuditAction(value));
    },
    [dispatch]
  );

  // Audit logger
  const logAudit = useCallback(
    (action, target, level = "info", client = "—") => {
      createAuditLogApi({ action, target, level, client }).catch(() => {});
    },
    []
  );

  // Dynamic counts for sidebar badges
  const counts = useMemo(() => {
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const safeInsurers = Array.isArray(insurers) ? insurers : [];
    const safeLeads = Array.isArray(leads) ? leads : [];

    return {
      tickets: safeTickets.filter((t) => t.status === "open").length,
      billing: safeInvoices.filter((i) => i.status === "overdue" || i.status === "failed").length,
      insurers: safeInsurers.filter((i) => i.status === "error").length,
      leads: safeLeads.filter((l) => l.status === "Open" || l.status === "Follow-up").length,
    };
  }, [tickets, invoices, insurers, leads]);

  return {
    authed,
    currentUser,
    setCurrentUser,
    login,
    verifyMfa,
    resendMfa,
    logout,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleCollapse,
    clients,
    setClients,
    plans,
    setPlans,
    coupons,
    setCoupons,
    users,
    setUsers,
    roles,
    setRoles,
    catalogue,
    setCatalogue,
    insurers,
    setInsurers,
    cdt,
    setCdt,
    invoices,
    setInvoices,
    tickets,
    setTickets,
    announcements,
    setAnnouncements,
    leads,
    setLeads,
    links,
    setLinks,
    audit,
    setAudit,
    toasts,
    push,
    logAudit,
    counts,
  };
}

export default useAdmin;
