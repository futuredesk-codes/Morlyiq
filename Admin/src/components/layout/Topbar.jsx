import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, BellOff, CheckCheck, ChevronRight, CircleCheck, Info, Menu, TriangleAlert } from "lucide-react";
import { C } from "../../constants/theme.js";
import { SearchBox } from "../common/FormControls.jsx";
import { IconBtn } from "../common/Button.jsx";
import { useAdmin } from "../../store/useAdmin.js";
import {
  fetchAdminNotificationsApi,
  markAdminNotificationReadApi,
  markAllAdminNotificationsReadApi,
} from "../../services/notificationService.js";

const tone = {
  info: { color: C.blue, bg: C.blueSoft, Icon: Info },
  success: { color: C.success, bg: C.successSoft, Icon: CircleCheck },
  warn: { color: C.warn, bg: C.warnSoft, Icon: TriangleAlert },
  error: { color: C.danger, bg: C.dangerSoft, Icon: AlertCircle },
};

const timeAgo = (value) => {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export function Topbar({ title }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifCount, setNotifCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { currentUser, setSidebarOpen } = useAdmin();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchAdminNotificationsApi();
      setNotifications(Array.isArray(data?.notifications) ? data.notifications : []);
      setNotifCount(Number(data?.unreadCount || 0));
    } catch {
      // The bell must not interrupt Admin navigation during a temporary API issue.
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const onVisible = () => document.visibilityState === "visible" && loadNotifications({ silent: true });
    document.addEventListener("visibilitychange", onVisible);
    const id = setInterval(() => loadNotifications({ silent: true }), 60_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(id);
    };
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function openNotification(notification) {
    if (!notification.read) {
      try {
        await markAdminNotificationReadApi(notification.id);
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read: true } : item));
        setNotifCount((count) => Math.max(0, count - 1));
      } catch {
        return;
      }
    }
    setOpen(false);
    if (notification.actionUrl) navigate(notification.actionUrl);
  }

  async function markAllRead() {
    try {
      await markAllAdminNotificationsReadApi();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
      setNotifCount(0);
    } catch {
      // Keep the current read state if the server did not confirm the update.
    }
  }

  return (
    <header
      className="h-[62px] bg-white border-b flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0"
      style={{ borderColor: C.border }}
    >
      {/* Left: Mobile Menu Toggle & Breadcrumbs */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-1.5 rounded-lg text-textMute hover:text-text hover:bg-blueSoft transition-colors border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0"
          title="Open menu"
        >
          <Menu size={19} />
        </button>

        <div className="font-sans text-[13.5px] text-textMute flex items-center gap-1.5 truncate">
          <span className="hidden sm:inline">{currentUser?.role || "Admin"}</span>
          <ChevronRight size={13} className="hidden sm:inline shrink-0 opacity-60" />
          <span className="font-semibold text-text truncate">{title}</span>
        </div>
      </div>

      {/* Right: Search & Notifications */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="hidden md:block">
          <SearchBox
            value=""
            onChange={() => {}}
            placeholder="Search clients, users, leads..."
          />
        </div>

        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <IconBtn
              icon={Bell}
              onClick={() => {
                setOpen((value) => !value);
                if (!open) loadNotifications({ silent: true });
              }}
              title="Notifications"
            />
            {notifCount > 0 && (
              <span
                className="absolute top-1 right-1 text-white text-[9.5px] font-bold rounded-full px-1 min-w-[15px] h-[15px] flex items-center justify-center pointer-events-none"
                style={{ background: C.danger }}
              >
                {notifCount}
              </span>
            )}
          </div>

          {open && (
            <div
              className="absolute right-0 top-10 w-[min(360px,calc(100vw-24px))] bg-white border rounded-xl shadow-modal z-40 animate-fade-in overflow-hidden"
              style={{
                borderColor: C.border,
                boxShadow: "0 12px 30px rgba(11,27,51,0.18)",
              }}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: C.border }}>
                <div>
                  <div className="text-[13px] font-bold" style={{ color: C.text }}>Notifications</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: C.textFaint }}>{notifCount} unread</div>
                </div>
                {notifCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="border-0 bg-transparent cursor-pointer text-[11px] font-semibold flex items-center gap-1"
                    style={{ color: C.blue }}
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {loading && <div className="py-10 text-center text-[12px]" style={{ color: C.textFaint }}>Loading notifications...</div>}
                {!loading && notifications.length === 0 && (
                  <div className="py-10 px-5 text-center">
                    <BellOff size={27} className="mx-auto mb-2" style={{ color: C.textFaint }} />
                    <div className="text-[12.5px] font-semibold" style={{ color: C.text }}>You're all caught up</div>
                    <div className="text-[11px] mt-1" style={{ color: C.textFaint }}>Role-relevant updates will appear here.</div>
                  </div>
                )}
                {!loading && notifications.map((notification) => {
                  const presentation = tone[notification.type] || tone.info;
                  const NotificationIcon = presentation.Icon;
                  return (
                    <button
                      type="button"
                      key={notification.id}
                      onClick={() => openNotification(notification)}
                      className="w-full border-0 border-b bg-white hover:bg-[#F8FAFE] cursor-pointer text-left px-3.5 py-3 flex gap-3 transition-colors"
                      style={{ borderColor: C.border }}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: presentation.bg, color: presentation.color }}>
                        <NotificationIcon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="text-[12px] font-semibold leading-4 flex-1" style={{ color: C.text }}>{notification.title}</span>
                          {!notification.read && <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: C.blue }} />}
                        </span>
                        <span className="block text-[11px] leading-4 mt-1" style={{ color: C.textMute }}>{notification.message}</span>
                        <span className="block text-[9.5px] mt-1.5" style={{ color: C.textFaint }}>{timeAgo(notification.createdAt)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
