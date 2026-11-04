import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, X, ChevronLeft, ChevronRight } from "lucide-react";
import { C } from "../../constants/theme.js";
import { LOGO_ICON } from "../../constants/logo.js";
import { canAccessAdminView, NAV_SECTIONS } from "../../constants/navigation.js";
import { useAdmin } from "../../store/useAdmin.js";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    counts,
    currentUser,
    logout,
    push,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useAdmin();

  const handleLogout = () => {
    setSidebarOpen(false);
    void logout();
    push("Signed out of Admin Console", "warn");
    navigate("/login");
  };

  const handleNavigate = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const currentPath = location.pathname.replace(/\/$/, "");
  const visibleSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessAdminView(item.key, currentUser)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-navy/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 bg-navy h-screen max-h-screen flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        } ${
          sidebarCollapsed
            ? "w-[250px] lg:w-[70px] p-[16px_10px] lg:p-[14px_8px]"
            : "w-[250px] p-[16px_10px]"
        }`}
        style={{ background: C.navy }}
      >
        {/* Brand Header */}
        <div
          className={`flex items-center pb-[16px] pt-[2px] shrink-0 ${
            sidebarCollapsed
              ? "justify-between px-[6px] lg:justify-center lg:flex-col lg:gap-2.5 lg:px-0"
              : "justify-between px-[6px]"
          }`}
        >
          <div
            className="flex items-center gap-[9px] cursor-pointer"
            onClick={() => handleNavigate("/dashboard")}
            title="MorlyIQ Admin Console"
          >
            <div className="w-[36px] h-[36px] rounded-[9px] bg-white flex items-center justify-center shrink-0 p-1">
              <img
                src={LOGO_ICON}
                alt="MorlyIQ"
                className="w-full h-full object-contain"
              />
            </div>
            <div className={`${sidebarCollapsed ? "block lg:hidden" : "block"}`}>
              <div className="font-sans font-extrabold text-[15.5px] text-white tracking-[0.2px]">
                MorlyIQ
              </div>
              <div className="font-sans font-medium text-[10px] text-[#9FB3E0] uppercase tracking-[0.5px]">
                {currentUser?.role || "Admin"}
              </div>
            </div>
          </div>

          {/* Desktop Collapse/Expand Toggle Button */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden lg:flex p-1.5 rounded-[7px] text-[#9FB3E0] hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer items-center justify-center"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-[#9FB3E0] hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar py-1">
          {visibleSections.map((sec) => (
            <div
              key={sec.section}
              className={sidebarCollapsed ? "mb-1 lg:mb-1" : "mb-2.5"}
            >
              {/* Section Header */}
              <div
                className={`font-sans text-[10.5px] font-bold text-[#7B93C9] uppercase tracking-[0.6px] px-3 pb-[5px] ${
                  sidebarCollapsed ? "block lg:hidden" : "block"
                }`}
              >
                {sec.section}
              </div>

              {sec.items.map((item) => {
                const active =
                  currentPath === item.path ||
                  (item.path === "/dashboard" &&
                    (currentPath === "" || currentPath === "/dashboard"));
                const Icon = item.icon;
                const count = counts[item.key];

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    title={item.label}
                    className={`relative flex items-center w-full py-[8px] rounded-[9px] cursor-pointer font-sans text-[13px] font-medium text-left mb-[2px] transition-all group ${
                      sidebarCollapsed
                        ? "px-3 gap-[10px] lg:px-0 lg:justify-center lg:gap-0"
                        : "px-3 gap-[10px]"
                    }`}
                    style={{
                      background: active ? "rgba(255,255,255,0.12)" : "transparent",
                      color: active ? "#ffffff" : "#C7D4EE",
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "none",
                      borderLeft: active ? `3px solid ${C.blue}` : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                        e.currentTarget.style.color = "#ffffff";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "#C7D4EE";
                      }
                    }}
                  >
                    <Icon size={16} className="shrink-0" />

                    {/* Item label (visible in full mode or on mobile) */}
                    <span
                      className={`truncate ${
                        sidebarCollapsed ? "block lg:hidden" : "flex-1 ml-[10px]"
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* Badge Count */}
                    {!!count && (
                      <span
                        className={`text-white text-[10.5px] font-bold rounded-full px-1.5 min-w-[18px] text-center shrink-0 ${
                          sidebarCollapsed
                            ? "block lg:absolute lg:top-1 lg:right-1 lg:p-0 lg:w-2 lg:h-2 lg:min-w-0 lg:rounded-full lg:text-[0px]"
                            : "ml-auto"
                        }`}
                        style={{
                          background: active ? C.blue : "rgba(255,255,255,0.18)",
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Footer Profile */}
        <div
          className={`border-t border-white/10 flex items-center pt-3 pb-1 shrink-0 ${
            sidebarCollapsed
              ? "gap-2.5 px-2 lg:px-0 lg:justify-center lg:flex-col"
              : "gap-2.5 px-2"
          }`}
        >
          <div
            className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-white font-sans font-bold text-[12.5px] shrink-0"
            style={{ background: C.blue }}
            title={currentUser?.name}
          >
            {currentUser?.initials || "TR"}
          </div>

          <div
            className={`flex-1 min-w-0 ${
              sidebarCollapsed ? "block lg:hidden" : "block"
            }`}
          >
            <div className="font-sans text-[12.5px] font-semibold text-white truncate">
              {currentUser?.name || "Tushar Rawat"}
            </div>
            <div className="font-sans text-[10.5px] text-[#9FB3E0] truncate">
              {currentUser?.org || "FutureDesks Services"}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 rounded-[7px] text-[#9FB3E0] hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>
    </>
  );
}
