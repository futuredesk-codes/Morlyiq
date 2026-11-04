import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogOut, X, ChevronLeft, ChevronRight } from "lucide-react";
import { LOGO_ICON } from "../../constants/theme";
import { NAV_SECTIONS, canView } from "../../constants/rbac";
import { useApp } from "../../store/useApp";
import { logoutApi } from "../../services/authService";

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    role,
    counts,
    currentUser,
    logout,
    push,
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    toggleCollapse,
  } = useApp();

  const handleLogout = () => {
    setSidebarOpen(false);
    logoutApi(); // ends this device's session on the server
    logout();
    push("Signed out successfully", "neutral");
    navigate("/login");
  };

  const handleNavigate = (path) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const currentPath = location.pathname.replace(/\/$/, "");

  return (
    <aside
      className={`fixed lg:sticky lg:top-0 inset-y-0 left-0 z-50 bg-navy h-screen max-h-screen flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-2xl lg:shadow-none ${
        sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${
        sidebarCollapsed
          ? "w-[246px] lg:w-[70px] p-[16px_10px] lg:p-[14px_8px]"
          : "w-[246px] p-[16px_10px]"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`flex items-center pb-[16px] pt-[2px] ${
          sidebarCollapsed
            ? "justify-between px-[6px] lg:justify-center lg:flex-col lg:gap-2.5 lg:px-0"
            : "justify-between px-[6px]"
        }`}
      >
        <div
          className="flex items-center gap-[9px] cursor-pointer"
          onClick={() => handleNavigate("/dashboard")}
          title="MorlyIQ Dashboard"
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
              Smarter Dental Operations
            </div>
          </div>
        </div>

        {/* Desktop Collapse/Expand Toggle Button */}
        <button
          type="button"
          onClick={toggleCollapse}
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
        {NAV_SECTIONS.map((sec) => {
          const visibleItems = sec.items.filter((item) => canView(item.key, role));
          if (visibleItems.length === 0) return null;
          return (
            <div key={sec.section} className={sidebarCollapsed ? "mb-1 lg:mb-1" : "mb-2.5"}>
              {/* Section Header */}
              <div
                className={`font-sans text-[10.5px] font-bold text-[#7B93C9] uppercase tracking-[0.6px] px-3 pb-[5px] ${
                  sidebarCollapsed ? "block lg:hidden" : "block"
                }`}
              >
                {sec.section}
              </div>
              {visibleItems.map((item) => {
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
                    className={`relative flex items-center w-full py-[9px] rounded-[9px] cursor-pointer font-sans text-[13.5px] font-medium text-left mb-[3px] transition-all group ${
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
                      borderLeft: active ? "3px solid #2F6FED" : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
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
                    <Icon size={17} className="shrink-0" />
                    
                    {/* Item label (visible in full mode or on mobile) */}
                    <span
                      className={`truncate ${
                        sidebarCollapsed ? "block lg:hidden" : "flex-1 ml-[10px]"
                      }`}
                    >
                      {item.label}
                    </span>

                    {/* Count badge in expanded mode */}
                    {!!count && (
                      <span
                        className={`text-white text-[10.5px] font-bold rounded-full px-1.5 min-w-[16px] text-center ${
                          sidebarCollapsed ? "inline-block lg:hidden" : "inline-block"
                        }`}
                        style={{
                          background: active ? "#2F6FED" : "rgba(255,255,255,0.14)",
                        }}
                      >
                        {count}
                      </span>
                    )}

                    {/* Notification dot in collapsed mode on desktop */}
                    {!!count && sidebarCollapsed && (
                      <span className="hidden lg:block absolute top-2 right-2 w-2 h-2 rounded-full bg-[#2F6FED] ring-2 ring-navy" />
                    )}

                    {/* Floating Tooltip on desktop hover when collapsed */}
                    {sidebarCollapsed && (
                      <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1.5 bg-[#0A1628] text-white text-[12px] font-medium rounded-[7px] shadow-2xl whitespace-nowrap z-50 pointer-events-none items-center gap-1.5 border border-white/15">
                        <span>{item.label}</span>
                        {!!count && (
                          <span className="bg-[#2F6FED] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                            {count}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* User Profile Footer */}
      <div
        className={`border-t border-white/12 flex items-center pt-3 pb-1 mt-auto shrink-0 transition-all ${
          sidebarCollapsed
            ? "px-[8px] gap-[9px] lg:flex-col lg:gap-2 lg:px-0 lg:justify-center"
            : "px-[8px] gap-[9px]"
        }`}
      >
        <div
          className="w-[30px] h-[30px] rounded-full bg-brand-blue flex items-center justify-center text-white font-sans font-bold text-[12.5px] shrink-0"
          title={`${currentUser.name} (${role})`}
        >
          {currentUser.initials}
        </div>
        <div
          className={`min-w-0 ${
            sidebarCollapsed ? "block lg:hidden flex-1" : "flex-1"
          }`}
        >
          <div className="font-sans text-[12.5px] font-semibold text-white truncate">
            {currentUser.name}
          </div>
          <div className="font-sans text-[10.5px] text-[#9FB3E0]">{role}</div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          title="Sign out"
          className="bg-transparent border-0 cursor-pointer p-1.5 flex items-center justify-center rounded-[6px] hover:bg-white/10 transition-colors shrink-0"
        >
          <LogOut size={14} color="#9FB3E0" />
        </button>
      </div>
    </aside>
  );
}
