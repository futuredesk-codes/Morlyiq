import {
  LayoutGrid, Building2, CreditCard, Users, ShieldCheck, ListChecks, Receipt,
  LifeBuoy, Megaphone, ScrollText, Settings, UserCog, KeyRound, PhoneCall,
  Link2, FileBarChart, Calendar, ClipboardList, StickyNote, Flag
} from "lucide-react";

export const RESOURCES = ["Dashboard", "Users", "Leads", "Calls", "Tasks", "Claims", "Eligibility", "PDFs", "Reports", "External Links"];
export const PERMS = ["view", "create", "edit", "delete", "assign", "export", "approve", "execute", "administer"];

export const NAV_SECTIONS = [
  { section: "Overview", items: [{ key: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutGrid }] },
  { section: "Platform", items: [
    { key: "clients", path: "/clients", label: "Clients", icon: Building2 },
    { key: "users", path: "/users", label: "Users", icon: Users },
    { key: "roles", path: "/roles", label: "Roles & Permissions", icon: UserCog },
    { key: "features", path: "/features", label: "Feature Catalogue", icon: KeyRound },
    { key: "plans", path: "/plans", label: "Plans & Coupons", icon: CreditCard },
  ] },
  { section: "Growth", items: [{ key: "leads", path: "/leads", label: "Leads & Calling", icon: PhoneCall }] },
  { section: "Verification data", items: [
    { key: "insurers", path: "/insurers", label: "Insurers / Clearinghouse", icon: ShieldCheck },
    { key: "cdt", path: "/cdt", label: "CDT Master Table", icon: ListChecks },
  ] },
  { section: "Operations", items: [
    { key: "links", path: "/links", label: "External Links", icon: Link2 },
    { key: "billing", path: "/billing", label: "Billing", icon: Receipt },
    { key: "tickets", path: "/tickets", label: "Support Tickets", icon: LifeBuoy },
    { key: "announcements", path: "/announcements", label: "Announcements", icon: Megaphone },
  ] },
  { section: "Oversight", items: [
    { key: "reports", path: "/reports", label: "Reports", icon: FileBarChart },
    { key: "audit", path: "/audit", label: "Audit Logs", icon: ScrollText },
  ] },
  { section: "System", items: [{ key: "settings", path: "/settings", label: "Platform Settings", icon: Settings }] },
];

export const canAdminDo = (user, resource, action) =>
  user?.role === "Super Admin"
  || user?.permissions?.includes(`${resource}:${action}`);

const VIEW_PERMISSIONS = {
  dashboard: [["dashboard", "view"]],
  leads: [["leads", "view"]],
  cdt: [["eligibility", "view"]],
  reports: [["reports", "view"]],
  links: [["external_links", "view"]],
  roles: [["users", "administer"]],
};

export const canAccessAdminView = (viewKey, user) => {
  if (user?.role === "Super Admin") return true;
  return (VIEW_PERMISSIONS[viewKey] || []).some(([resource, action]) =>
    canAdminDo(user, resource, action)
  );
};

export const firstAccessibleAdminPath = (user) =>
  NAV_SECTIONS.flatMap((section) => section.items)
    .find((item) => canAccessAdminView(item.key, user))?.path || null;

export const VIEW_TITLES = {
  dashboard: "Dashboard",
  clients: "Clients",
  users: "Users",
  roles: "Roles & Permissions",
  features: "Feature Catalogue",
  plans: "Plans & Coupons",
  leads: "Leads & Calling",
  insurers: "Insurers / Clearinghouse",
  cdt: "CDT Master Table",
  links: "External Links",
  billing: "Billing",
  tickets: "Support Tickets",
  announcements: "Announcements",
  reports: "Reports",
  audit: "Audit Logs",
  settings: "Platform Settings",
};

export const LEAD_STATUSES = ["Open", "Contacted", "Follow-up", "Won", "Lost"];

export const STATUS_TONE = {
  active: "success", trial: "blue", past_due: "warn", suspended: "danger",
  archived: "neutral", paid: "success", overdue: "danger", failed: "danger",
  open: "warn", pending: "blue", closed: "neutral", invited: "blue",
  deactivated: "neutral", inactive: "warn", error: "danger", published: "success", draft: "neutral",
  Active: "success", Draft: "neutral", Inactive: "warn", Archived: "neutral",
  Open: "warn", Contacted: "blue", "Follow-up": "warn", Won: "success", Lost: "danger",
};

export const STATUS_LABEL = {
  active: "Active", trial: "Trial", past_due: "Past due", suspended: "Suspended",
  archived: "Archived", paid: "Paid", overdue: "Overdue", failed: "Failed",
  open: "Open", pending: "Pending", closed: "Closed", invited: "Invited",
  deactivated: "Deactivated", inactive: "Inactive", error: "Error",
};

export const ACTIVITY_ICON = {
  call: PhoneCall,
  note: StickyNote,
  followup: Calendar,
  task: ClipboardList,
  status: Flag,
};

export const ACTIVITY_LABEL = {
  call: "Call logged",
  note: "Note",
  followup: "Follow-up scheduled",
  task: "Task",
  status: "Status changed",
};
