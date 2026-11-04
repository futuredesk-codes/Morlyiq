import { useMemo, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  login as loginAction,
  logout as logoutAction,
  setViewAsRole as setViewAsRoleAction,
  setClinicId as setClinicIdAction,
  setClinics as setClinicsAction,
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
} from "./slices/ticketsSlice.js";
import {
  setPatients as setPatientsAction,
  setStaff as setStaffAction,
  setInsurers as setInsurersAction,
  setNotifications as setNotificationsAction,
  setClaims as setClaimsAction,
} from "./slices/dataSlice.js";
import { nextId } from "../utils/id.js";
import store from "./index.js";

/**
 * Custom Redux Hook providing unified store access and dispatch helpers
 */
export function useApp() {
  const dispatch = useDispatch();

  // Redux state selectors
  const authed = useSelector((state) => state.auth.authed);
  const token = useSelector((state) => state.auth.token);
  const role = useSelector((state) => state.auth.role);
  const actualRole = useSelector((state) => state.auth.actualRole);
  const clinicId = useSelector((state) => state.auth.clinicId);
  const clinics = useSelector((state) => state.auth.clinics);
  const tenant = useSelector((state) => state.auth.tenant);
  const currentUser = useSelector((state) => state.auth.currentUser);

  const sidebarOpen = useSelector((state) => state.ui.sidebarOpen);
  const sidebarCollapsed = useSelector((state) => state.ui.sidebarCollapsed);
  const toasts = useSelector((state) => state.ui.toasts);

  const tickets = useSelector((state) => state.tickets.tickets);

  const patients = useSelector((state) => state.data.patients);
  const staff = useSelector((state) => state.data.staff);
  const insurers = useSelector((state) => state.data.insurers);
  const invoices = useSelector((state) => state.data.invoices);
  const notifications = useSelector((state) => state.data.notifications);
  const claims = useSelector((state) => state.data.claims);

  // Redux dispatch actions
  const login = useCallback(
    (credentials) => dispatch(loginAction(credentials)),
    [dispatch]
  );

  const logout = useCallback(() => dispatch(logoutAction()), [dispatch]);
  const setViewAsRole = useCallback(
    (newRole) => dispatch(setViewAsRoleAction(newRole)),
    [dispatch]
  );

  const setClinicId = useCallback(
    (id) => dispatch(setClinicIdAction(id)),
    [dispatch]
  );

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

  const setTickets = useCallback(
    (actionOrValue) => {
      const current = store.getState().tickets.tickets;
      const value =
        typeof actionOrValue === "function"
          ? actionOrValue(current)
          : actionOrValue;
      dispatch(setTicketsAction(value));
    },
    [dispatch]
  );

  const setPatients = useCallback(
    (actionOrValue) => dispatch(setPatientsAction(actionOrValue)),
    [dispatch]
  );

  const setClinics = useCallback(
    (actionOrValue) => dispatch(setClinicsAction(actionOrValue)),
    [dispatch]
  );

  const setStaff = useCallback(
    (actionOrValue) => dispatch(setStaffAction(actionOrValue)),
    [dispatch]
  );

  const setInsurers = useCallback(
    (actionOrValue) => dispatch(setInsurersAction(actionOrValue)),
    [dispatch]
  );

  const setNotifications = useCallback(
    (actionOrValue) => dispatch(setNotificationsAction(actionOrValue)),
    [dispatch]
  );

  const setClaims = useCallback(
    (actionOrValue) => dispatch(setClaimsAction(actionOrValue)),
    [dispatch]
  );

  // Global clinic filter: data below is scoped to the ACTIVE clinic. Items without a clinicId
  // are account-level (e.g. plan renewal notices) and show at every clinic.
  const inClinic = useCallback((item) => !item.clinicId || item.clinicId === clinicId, [clinicId]);
  const clinicClaims = useMemo(() => (Array.isArray(claims) ? claims : []).filter(inClinic), [claims, inClinic]);
  const clinicInsurers = useMemo(() => (Array.isArray(insurers) ? insurers : []).filter(inClinic), [insurers, inClinic]);

  // Dynamic counts for sidebar badges
  const counts = useMemo(() => {
    const safeStaff = Array.isArray(staff) ? staff : [];
    const safeInsurers = clinicInsurers;
    const safeTickets = Array.isArray(tickets) ? tickets : [];
    const safeClaims = clinicClaims;

    return {
      staff: safeStaff.filter((s) => s.status === "invited").length,
      insurers: safeInsurers.filter((i) => i.status === "error").length,
      support: safeTickets.filter((t) => t.status === "open").length,
      claims: safeClaims.filter((c) => ["ready", "validation_failed", "stedi_rejected", "submission_error"].includes(c.status)).length,
    };
  }, [staff, clinicInsurers, tickets, clinicClaims]);

  const clinicNotifications = useMemo(
    () => (Array.isArray(notifications) ? notifications : []).filter(inClinic),
    [notifications, inClinic]
  );
  const safeNotifications = clinicNotifications;

  const notifCount = useMemo(
    () => safeNotifications.filter((n) => !n.read).length,
    [safeNotifications]
  );

  const notifItems = useMemo(
    () => safeNotifications.filter((n) => !n.read).map((n) => n.text),
    [safeNotifications]
  );

  return {
    authed,
    token,
    login,
    logout,
    role,
    actualRole,
    setViewAsRole,
    clinicId,
    tenant,
    setClinicId,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    sidebarCollapsed,
    setSidebarCollapsed,
    toggleCollapse,
    patients,
    setPatients,
    clinics,
    setClinics,
    clinicClaims,
    clinicInsurers,
    clinicNotifications,
    staff,
    setStaff,
    insurers,
    setInsurers,
    invoices,
    notifications,
    setNotifications,
    tickets,
    setTickets,
    claims,
    setClaims,
    toasts,
    push,
    counts,
    notifCount,
    notifItems,
    currentUser,
  };
}

export default useApp;
