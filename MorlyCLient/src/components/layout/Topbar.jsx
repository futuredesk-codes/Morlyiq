import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, MapPin, Bell, Menu } from "lucide-react";
import { ROLES, VIEW_TITLES } from "../../constants/rbac";
import { IconBtn } from "../common/Button";
import { useApp } from "../../store/useApp";

export function Topbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    role,
    actualRole,
    setViewAsRole,
    tenant,
    clinics,
    clinicId,
    setClinicId,
    notifCount,
    notifItems,
    toggleSidebar,
    sidebarCollapsed,
    toggleCollapse,
  } = useApp();
  const [open, setOpen] = useState(false);

  const pathKey = location.pathname.replace(/^\//, "") || "dashboard";
  const title = VIEW_TITLES[pathKey] || "Dashboard";

  const handleMenuClick = () => {
    if (window.innerWidth >= 1024) {
      toggleCollapse();
    } else {
      toggleSidebar();
    }
  };

  return (
    <div className="h-[62px] bg-white border-b border-[#DFE6F5] flex items-center justify-between px-2.5 sm:px-6 sticky top-0 z-20 gap-1.5 sm:gap-3.5">
      {/* Left side: Hamburger button + Breadcrumbs */}
      <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
        <button
          type="button"
          onClick={handleMenuClick}
          className="p-1.5 rounded-[7px] text-textMute hover:text-brand-text hover:bg-blueSoft/50 transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0"
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label="Toggle Navigation"
        >
          <Menu size={19} />
        </button>

        <div className="font-sans text-[13px] sm:text-[13.5px] text-[#5E6C87] flex items-center gap-1.5 min-w-0">
          <span className="hidden md:inline shrink-0">{tenant?.name || "Bright Smiles Dental"}</span>
          <ChevronRight size={13} className="hidden md:inline shrink-0" />
          <span className="text-[#0F1B33] font-semibold truncate">{title}</span>
        </div>
      </div>

      {/* Right side: Clinic + Role + Notification Bell (Always single-line, shrink-0) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-nowrap shrink-0">
        {/* Clinic Selector */}
        {clinics.length > 0 && (
        <div className="flex items-center gap-1">
          <MapPin size={13} color="#8C97AE" className="shrink-0 hidden md:inline" />
          <select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            disabled={clinics.length < 2}
            className="w-[105px] xs:w-[130px] sm:w-[200px] md:w-[220px] py-1 sm:py-[6px] px-1.5 sm:px-2.5 rounded-[9px] border border-[#DFE6F5] font-sans text-[11px] sm:text-[12.5px] text-[#0F1B33] outline-none bg-white cursor-pointer hover:border-[#C6D3EE] focus:border-[#2F6FED] transition-colors truncate"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        )}

        {/* Viewing as: only the practice Owner can preview other roles */}
        {actualRole === "Owner" && (
        <div className="flex items-center gap-1 bg-[#F1F5FE] border border-[#DFE6F5] rounded-[9px] p-0.5 sm:py-1 sm:pl-2.5 sm:pr-1">
          <span className="font-sans text-[11px] sm:text-[11.5px] text-[#5E6C87] font-semibold whitespace-nowrap hidden sm:inline pl-0.5">
            Viewing as
          </span>
          <select
            value={role}
            onChange={(e) => setViewAsRole(e.target.value)}
            className="w-[66px] sm:w-[96px] py-0.5 sm:py-1 px-1 sm:px-2 rounded-[7px] border-0 font-sans text-[11px] sm:text-[12.5px] text-[#0F1B33] font-semibold outline-none bg-white cursor-pointer hover:bg-slate-50 transition-colors"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        )}

        {/* Notification Bell */}
        <div className="relative shrink-0">
          <IconBtn
            icon={Bell}
            onClick={() => setOpen((o) => !o)}
            title="Notifications"
          />
          {notifCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#C23B3B] text-white text-[9px] font-bold rounded-full px-1 min-w-[14px] text-center pointer-events-none leading-tight py-[1px]">
              {notifCount}
            </span>
          )}
          {open && (
            <div className="absolute right-0 top-9 w-[280px] sm:w-[290px] bg-white border border-[#DFE6F5] rounded-[12px] shadow-popover p-2.5 z-30">
              <div className="font-sans text-[12.5px] font-bold text-[#0F1B33] py-1 px-1.5 pb-2 flex justify-between items-center">
                <span>Notifications</span>
                <button
                  type="button"
                  className="text-[11px] text-[#2F6FED] cursor-pointer font-semibold bg-transparent border-0 hover:underline"
                  onClick={() => {
                    setOpen(false);
                    navigate("/notifications");
                  }}
                >
                  View all
                </button>
              </div>
              {notifItems.length === 0 ? (
                <div className="py-3 px-1.5 font-sans text-[12px] text-[#8C97AE] text-center">
                  No unread notifications
                </div>
              ) : (
                notifItems.map((n, i) => (
                  <div
                    key={i}
                    className={`py-2 px-1.5 font-sans text-[12.5px] text-[#5E6C87] ${
                      i > 0 ? "border-t border-[#DFE6F5]" : ""
                    }`}
                  >
                    {n}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
