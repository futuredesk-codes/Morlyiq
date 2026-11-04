import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import LoginPage from "../pages/LoginPage";
import DashboardPage from "../pages/DashboardPage";
import PatientsPage from "../pages/PatientsPage";
import PatientEligibilityPage from "../pages/PatientEligibilityPage";
import ClinicsPage from "../pages/ClinicsPage";
import StaffPage from "../pages/StaffPage";
import InsurersPage from "../pages/InsurersPage";
import ClaimsPage from "../pages/ClaimsPage";
import ReportsPage from "../pages/ReportsPage";
import BillingPage from "../pages/BillingPage";
import NotificationsPage from "../pages/NotificationsPage";
import SecurityPage from "../pages/SecurityPage";
import SupportPage from "../pages/SupportPage";
import OnboardingPage from "../pages/OnboardingPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding/:token" element={<OnboardingPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:patientId/eligibility" element={<PatientEligibilityPage />} />
        <Route path="clinics" element={<ClinicsPage />} />
        <Route path="staff" element={<StaffPage />} />
        <Route path="insurers" element={<InsurersPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="security" element={<SecurityPage />} />
        <Route path="support" element={<SupportPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
