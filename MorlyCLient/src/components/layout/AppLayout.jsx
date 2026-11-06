import React, { useEffect, useState } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { canView } from "../../constants/rbac";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ToastStack } from "../common/Feedback";
import { useApp } from "../../store/useApp";
import { fetchMeApi } from "../../services/authService";
import { fetchNotificationsApi } from "../../services/notificationService";
import { SessionLoader } from "../common/SessionLoader";

export function AppLayout() {
  const { authed, token, logout, role, clinicId, setClinics, toasts, sidebarOpen, setSidebarOpen, setNotifications, tenant, setTenant, platformSettings } = useApp();
  const location = useLocation();
  const [checkingSession, setCheckingSession] = useState(Boolean(authed && token));

  // If this device was signed out elsewhere (Active sessions / password change), leave. Every API call also
  // does this on a 401, so this only matters on a page that is just sitting open. Checked on load, when the
  // tab is shown again, and every 5 minutes while it is visible — not in the background.
  useEffect(() => {
    if (!authed || !token) {
      setCheckingSession(false);
      return undefined;
    }
    let active = true;
    setCheckingSession(true);
    const check = ({ initial = false } = {}) =>
      fetchMeApi(token)
        .then((session) => {
          // /auth/me also reconciles linked Stedi enrollment statuses. Keep
          // Redux and localStorage aligned with the fresh server response so a
          // browser reload does not continue showing stale cached clinic data.
          if (active && Array.isArray(session?.clinics)) setClinics(session.clinics);
          if (active && session?.tenant) setTenant(session.tenant);
        })
        .catch((err) => {
          if (active && ["SESSION_EXPIRED", "INVALID_TOKEN", "UNAUTHENTICATED", "ACCOUNT_UNAVAILABLE"].includes(err.code)) {
            logout();
          }
        })
        .finally(() => {
          if (active && initial) setCheckingSession(false);
        });
    const onVisible = () => document.visibilityState === "visible" && check();
    check({ initial: true });
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(onVisible, 5 * 60_000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [authed, token, logout, setClinics, setTenant]);

  // Keep the bell and Notifications page current on every Client Panel route.
  // The backend applies the real user's tenant, active-clinic and role filters.
  useEffect(() => {
    if (!authed || !token || !clinicId) {
      setNotifications([]);
      return undefined;
    }
    let active = true;
    const load = () => fetchNotificationsApi(clinicId)
      .then(({ notifications }) => {
        if (active) setNotifications(notifications);
      })
      .catch(() => {});
    const onVisible = () => document.visibilityState === "visible" && load();
    load();
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [authed, token, clinicId, setNotifications]);

  if (!authed) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const pathKey = location.pathname.replace(/^\//, "") || "dashboard";
  if (!canView(pathKey, role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="bg-[#F4F7FD] min-h-screen lg:h-screen lg:overflow-hidden font-sans">
      {checkingSession && <SessionLoader />}
      <div className="flex min-h-screen lg:h-screen relative">
        {/* Mobile Backdrop Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-40 lg:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Drawer */}
        <Sidebar />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 lg:h-screen lg:overflow-hidden">
          <Topbar />
          <main className="flex-1 p-3.5 sm:p-5 lg:p-[26px] overflow-auto lg:overflow-y-auto">
            {tenant?.status === "trial" && tenant.trialEndsAt && new Date(tenant.trialEndsAt) <= new Date() && <div role="alert" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
              Your practice trial has ended. Review your subscription or contact <a className="underline" href={`mailto:${platformSettings?.supportEmail || ""}`}>support</a>.
            </div>}
            <Outlet />
          </main>
        </div>
      </div>
      <ToastStack toasts={toasts} />
    </div>
  );
}
