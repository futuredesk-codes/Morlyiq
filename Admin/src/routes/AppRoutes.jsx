import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAdmin } from "../store/useAdmin.js";
import { AppLayout } from "../components/layout/AppLayout.jsx";
import { fetchAdminProfile } from "../services/authService.js";
import { canAccessAdminView, firstAccessibleAdminPath } from "../constants/navigation.js";
import { SessionLoader } from "../components/common/SessionLoader.jsx";

// Page imports
import LoginPage from "../pages/LoginPage.jsx";
import AcceptInvitationPage from "../pages/AcceptInvitationPage.jsx";
import DashboardPage from "../pages/DashboardPage.jsx";
import ClientsPage from "../pages/ClientsPage.jsx";
import UsersPage from "../pages/UsersPage.jsx";
import RolesPage from "../pages/RolesPage.jsx";
import FeaturesPage from "../pages/FeaturesPage.jsx";
import PlansPage from "../pages/PlansPage.jsx";
import LeadsPage from "../pages/LeadsPage.jsx";
import InsurersPage from "../pages/InsurersPage.jsx";
import CdtPage from "../pages/CdtPage.jsx";
import ExternalLinksPage from "../pages/ExternalLinksPage.jsx";
import BillingPage from "../pages/BillingPage.jsx";
import TicketsPage from "../pages/TicketsPage.jsx";
import AnnouncementsPage from "../pages/AnnouncementsPage.jsx";
import ReportsPage from "../pages/ReportsPage.jsx";
import AuditPage from "../pages/AuditPage.jsx";
import SettingsPage from "../pages/SettingsPage.jsx";

function ProtectedRoute({ children }) {
  const { authed, logout, setCurrentUser } = useAdmin();
  const [checking, setChecking] = useState(authed);

  useEffect(() => {
    let active = true;
    if (!authed) {
      setChecking(false);
      return () => { active = false; };
    }

    setChecking(true);
    fetchAdminProfile()
      .then(({ user }) => {
        if (active) setCurrentUser(user);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => { active = false; };
  }, [authed, logout, setCurrentUser]);

  if (checking) {
    return (
      <>
        {children}
        <SessionLoader />
      </>
    );
  }
  if (!authed) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { authed } = useAdmin();
  if (authed) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function AdminViewRoute({ viewKey, children }) {
  const { currentUser } = useAdmin();
  if (!canAccessAdminView(viewKey, currentUser)) {
    const fallbackPath = firstAccessibleAdminPath(currentUser);
    if (fallbackPath) return <Navigate to={fallbackPath} replace />;
    return <div className="p-6 text-sm">Your role does not have access to an Admin view.</div>;
  }
  return children;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route path="/accept-invitation/:token" element={<AcceptInvitationPage />} />

        {/* Protected Admin Routes within AppLayout */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminViewRoute viewKey="dashboard"><DashboardPage /></AdminViewRoute>} />
          <Route path="/clients" element={<AdminViewRoute viewKey="clients"><ClientsPage /></AdminViewRoute>} />
          <Route path="/users" element={<AdminViewRoute viewKey="users"><UsersPage /></AdminViewRoute>} />
          <Route path="/roles" element={<AdminViewRoute viewKey="roles"><RolesPage /></AdminViewRoute>} />
          <Route path="/features" element={<AdminViewRoute viewKey="features"><FeaturesPage /></AdminViewRoute>} />
          <Route path="/plans" element={<AdminViewRoute viewKey="plans"><PlansPage /></AdminViewRoute>} />
          <Route path="/leads" element={<AdminViewRoute viewKey="leads"><LeadsPage /></AdminViewRoute>} />
          <Route path="/insurers" element={<AdminViewRoute viewKey="insurers"><InsurersPage /></AdminViewRoute>} />
          <Route path="/cdt" element={<AdminViewRoute viewKey="cdt"><CdtPage /></AdminViewRoute>} />
          <Route path="/links" element={<AdminViewRoute viewKey="links"><ExternalLinksPage /></AdminViewRoute>} />
          <Route path="/billing" element={<AdminViewRoute viewKey="billing"><BillingPage /></AdminViewRoute>} />
          <Route path="/tickets" element={<AdminViewRoute viewKey="tickets"><TicketsPage /></AdminViewRoute>} />
          <Route path="/announcements" element={<AdminViewRoute viewKey="announcements"><AnnouncementsPage /></AdminViewRoute>} />
          <Route path="/reports" element={<AdminViewRoute viewKey="reports"><ReportsPage /></AdminViewRoute>} />
          <Route path="/audit" element={<AdminViewRoute viewKey="audit"><AuditPage /></AdminViewRoute>} />
          <Route path="/settings" element={<AdminViewRoute viewKey="settings"><SettingsPage /></AdminViewRoute>} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
