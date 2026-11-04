import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, ExternalLink, Link2, Megaphone } from "lucide-react";
import { Card } from "../components/common/Card";
import { Btn } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Toggle } from "../components/common/FormControls";
import { SectionHeader } from "../components/common/Feedback";
import { useApp } from "../store/useApp";
import {
  fetchNotificationContentApi,
  fetchNotificationPreferencesApi,
  markAllNotificationsReadApi,
  markNotificationReadApi,
  updateNotificationPreferencesApi,
} from "../services/notificationService";

const EMAIL_PREFERENCE_ROWS = {
  verifications: {
    label: "Verification results",
    desc: "Get an email when a patient verification completes or fails.",
  },
  billing: {
    label: "Billing & invoices",
    desc: "Receipts, renewal reminders and failed payment alerts.",
  },
  staff: {
    label: "Staff activity",
    desc: "New staff invitations, access updates and role changes.",
  },
  product: {
    label: "Product updates",
    desc: "New features and platform announcements.",
  },
};

function RowToggle({ label, desc, on, onChange, disabled = false }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <div>
        <div className="font-sans text-[13.5px] font-semibold text-brand-text">
          {label}
        </div>
        <div className="font-sans text-[12px] text-textMute mt-0.5">
          {desc}
        </div>
      </div>
      <Toggle on={on} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center px-5 text-center ${compact ? "min-h-[140px] py-7" : "min-h-[190px] py-9"}`}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blueSoft2 text-brand-blue">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <div className="font-sans text-[13.5px] font-semibold text-brand-text">{title}</div>
      <div className="mt-1 max-w-[320px] font-sans text-[12px] leading-5 text-textFaint">{description}</div>
    </div>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { clinicNotifications: notifications, clinicId, actualRole, setNotifications, push } = useApp();
  const [emailPrefs, setEmailPrefs] = useState({
    verifications: true,
    billing: true,
    staff: false,
    product: true,
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [availablePrefs, setAvailablePrefs] = useState([]);
  const [preferenceRole, setPreferenceRole] = useState(actualRole || "");
  const [content, setContent] = useState({ announcements: [], externalLinks: [] });
  const [contentLoading, setContentLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!clinicId) return () => { active = false; };
    setPrefsLoading(true);
    fetchNotificationPreferencesApi(clinicId)
      .then(({ email, available, role }) => {
        if (active) {
          setEmailPrefs(email);
          setAvailablePrefs(available || []);
          setPreferenceRole(role || actualRole || "");
        }
      })
      .catch((error) => {
        if (active) push(`Could not load notification preferences: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setPrefsLoading(false);
      });
    return () => { active = false; };
  }, [clinicId, push]);

  useEffect(() => {
    let active = true;
    if (!clinicId) return () => { active = false; };
    setContentLoading(true);
    fetchNotificationContentApi(clinicId)
      .then((data) => {
        if (active) setContent({
          announcements: data?.announcements || [],
          externalLinks: data?.externalLinks || [],
        });
      })
      .catch((error) => {
        if (active) push(`Could not load announcements and resources: ${error.message}`, "danger");
      })
      .finally(() => {
        if (active) setContentLoading(false);
      });
    return () => { active = false; };
  }, [clinicId, push]);

  async function markRead(n) {
    if (!n.read) {
      try {
        const updated = await markNotificationReadApi(clinicId, n.id);
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? updated : item)));
      } catch (error) {
        push(`Could not mark notification as read: ${error.message}`, "danger");
        return;
      }
    }
    if (n.actionUrl) navigate(n.actionUrl);
  }

  async function markAllRead() {
    try {
      await markAllNotificationsReadApi(clinicId);
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
      push("All notifications marked read");
    } catch (error) {
      push(`Could not mark notifications as read: ${error.message}`, "danger");
    }
  }

  async function changeEmailPreference(key, value) {
    if (prefsSaving) return;
    const previous = emailPrefs;
    const next = { ...emailPrefs, [key]: value };
    setEmailPrefs(next);
    setPrefsSaving(true);
    try {
      const { email, available, role } = await updateNotificationPreferencesApi(clinicId, { [key]: value });
      setEmailPrefs(email);
      setAvailablePrefs(available || availablePrefs);
      setPreferenceRole(role || preferenceRole);
      push("Notification preferences updated");
    } catch (error) {
      setEmailPrefs(previous);
      push(`Could not update preferences: ${error.message}`, "danger");
    } finally {
      setPrefsSaving(false);
    }
  }

  const typeTone = { warn: "warn", info: "blue", success: "success", danger: "danger" };
  const timeAgo = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const openExternalLink = (link) => {
    window.open(link.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div>
      <SectionHeader
        title="Notifications"
        subtitle={`Role-relevant alerts for ${actualRole || "your role"} at the active clinic`}
        action={
          <Btn variant="outline" onClick={markAllRead}>
            Mark all read
          </Btn>
        }
      />
      <Card noPad className="mb-6 overflow-hidden">
        {notifications.length === 0 && (
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            description="No notifications are available for your role at this clinic yet."
            compact
          />
        )}
        {notifications.map((n, i) => (
          <div
            key={n.id}
            onClick={() => markRead(n)}
            className={`flex gap-3 items-start px-4 py-3.5 cursor-pointer transition-colors ${i > 0 ? "border-t border-brand-border" : ""
              } ${n.read ? "bg-white hover:bg-slate-50/70" : "bg-blueSoft2 hover:bg-blueSoft/60"}`}
          >
            <Badge text={n.type} tone={typeTone[n.type]} />
            <div className="flex-1 min-w-0">
              <div className="font-sans text-[13px] font-semibold text-brand-text">
                {n.title}
              </div>
              <div className="font-sans text-[12.5px] text-textMute mt-0.5">
                {n.text}
              </div>
              <div className="font-sans text-[11.5px] text-textFaint mt-1">
                {timeAgo(n.createdAt)} · {String(n.category || "system").replaceAll("_", " ")}
              </div>
            </div>
            {!n.read && (
              <div className="w-2 h-2 rounded-full bg-brand-blue mt-[5px] shrink-0" />
            )}
          </div>
        ))}
      </Card>

      <div className="grid grid-cols-1 items-stretch gap-5 mb-6 xl:grid-cols-2">
        <section className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2 font-sans text-[16px] font-bold text-brand-text mb-3">
            <Megaphone size={17} className="text-brand-blue" />
            Announcements
          </div>
          <Card noPad className="flex-1 overflow-hidden">
            {contentLoading && (
              <div className="px-5 py-10 text-center font-sans text-[13px] text-textFaint">
                Loading announcements...
              </div>
            )}
            {!contentLoading && content.announcements.length === 0 && (
              <EmptyState
                icon={Megaphone}
                title="No announcements"
                description="There are no published updates for your practice, plan, or account status right now."
              />
            )}
            {!contentLoading && content.announcements.map((announcement, index) => (
              <article
                key={announcement.id}
                className={`px-5 py-4 ${index > 0 ? "border-t border-brand-border" : ""}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-sans text-[13.5px] font-semibold text-brand-text">
                      {announcement.title}
                    </div>
                    <p className="font-sans text-[12.5px] leading-5 text-textMute mt-1 whitespace-pre-line">
                      {announcement.body}
                    </p>
                  </div>
                  <Badge text="Update" tone="blue" />
                </div>
                <div className="font-sans text-[11.5px] text-textFaint mt-2">
                  Published {timeAgo(announcement.publishedAt)}
                </div>
              </article>
            ))}
          </Card>
        </section>

        <section className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2 font-sans text-[16px] font-bold text-brand-text mb-3">
            <Link2 size={17} className="text-brand-blue" />
            Resources & external links
          </div>
          <Card noPad className="flex-1 overflow-hidden">
            {contentLoading && (
              <div className="px-5 py-10 text-center font-sans text-[13px] text-textFaint">
                Loading resources...
              </div>
            )}
            {!contentLoading && content.externalLinks.length === 0 && (
              <EmptyState
                icon={Link2}
                title="No external resources"
                description="No enabled links are assigned to your client and current clinic role."
              />
            )}
            {!contentLoading && content.externalLinks.map((link, index) => (
              <div
                key={link.id}
                className={`flex items-center justify-between gap-4 px-5 py-4 ${index > 0 ? "border-t border-brand-border" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-sans text-[13.5px] font-semibold text-brand-text truncate">
                    {link.title}
                  </div>
                  <div className="font-sans text-[11.5px] text-textFaint mt-1">
                    {link.ssoType} · {link.openMode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalLink(link)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-border px-3 py-2 font-sans text-[12px] font-semibold text-brand-blue hover:bg-blueSoft2 transition-colors"
                >
                  Open <ExternalLink size={13} />
                </button>
              </div>
            ))}
          </Card>
        </section>
      </div>

      <div className="font-sans text-[16px] font-bold text-brand-text mb-1">
        Email preferences
      </div>
      <div className="font-sans text-[12px] text-textMute mb-3">
        Showing alerts relevant to the {preferenceRole || actualRole || "current"} role. Product updates are available to every role.
      </div>
      <Card>
        <div className="flex flex-col gap-4">
          {prefsLoading && (
            <div className="py-3 text-center font-sans text-[12.5px] text-textFaint">Loading email preferences...</div>
          )}
          {!prefsLoading && availablePrefs.map((key) => {
            const item = EMAIL_PREFERENCE_ROWS[key];
            if (!item) return null;
            return (
              <RowToggle
                key={key}
                label={item.label}
                desc={item.desc}
                on={Boolean(emailPrefs[key])}
                onChange={(value) => changeEmailPreference(key, value)}
                disabled={prefsSaving}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
