import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Topbar } from "./Topbar.jsx";
import { ToastStack } from "../common/ToastStack.jsx";
import { VIEW_TITLES } from "../../constants/navigation.js";
import { C } from "../../constants/theme.js";
import { useAdmin } from "../../store/useAdmin.js";

export function AppLayout() {
  const location = useLocation();
  const { toasts } = useAdmin();

  // Extract active section key from path: e.g. "/clients" -> "clients"
  const currentKey = location.pathname.split("/")[1] || "dashboard";
  const title = VIEW_TITLES[currentKey] || "Dashboard";

  return (
    <div
      className="h-screen max-h-screen w-full flex flex-row overflow-hidden font-sans select-none"
      style={{ background: C.bg }}
    >
      {/* Sidebar Navigation - Fixed & Non-Scrolling with page */}
      <Sidebar />

      {/* Main Content Column - Header is Fixed, only <main> scrolls */}
      <div className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden">
        {/* Topbar Header */}
        <Topbar title={title} />

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-[26px] overflow-y-auto min-h-0 select-text">
          <Outlet />
        </main>
      </div>

      {/* Global Toast Stack */}
      <ToastStack toasts={toasts} />
    </div>
  );
}
