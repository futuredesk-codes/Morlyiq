import {
  LayoutGrid,
  Users,
  Building2,
  UserCog,
  ShieldCheck,
  FileCheck2,
  FileText,
  CreditCard,
  Bell,
  Lock,
  LifeBuoy,
} from "lucide-react";

export const ROLES = ["Owner", "Manager", "Front Desk", "Billing", "Dentist"];
export const ALL = ROLES;

export const NAV_ACCESS = {
  dashboard: ALL,
  patients: ALL,
  clinics: ["Owner", "Manager"],
  staff: ["Owner", "Manager"],
  insurers: ["Owner", "Manager"],
  claims: ["Owner", "Manager", "Billing", "Front Desk"],
  reports: ["Owner", "Manager", "Billing"],
  billing: ["Owner", "Billing"],
  notifications: ALL,
  security: ALL,
  support: ALL,
};

export const canView = (view, role) => (NAV_ACCESS[view] || ALL).includes(role);
export const canDo = (allowedRoles, role) => allowedRoles.includes(role);

export const ENTITLEMENTS = {
  eligibility: true,
  insurance_discovery: true,
  cob: true,
  eligibility_pdfs: true,
  claims: true,
  era: true,
  claim_status: true,
  era_pdfs: false,
  acknowledgments: true,
};

export const NAV_SECTIONS = [
  { section: "Overview", items: [{ key: "dashboard", path: "/dashboard", label: "Dashboard", icon: LayoutGrid }] },
  { section: "Patients", items: [{ key: "patients", path: "/patients", label: "Patients", icon: Users }] },
  {
    section: "Practice",
    items: [
      { key: "clinics", path: "/clinics", label: "Clinics", icon: Building2 },
      { key: "staff", path: "/staff", label: "Staff & Roles", icon: UserCog },
      { key: "insurers", path: "/insurers", label: "Insurance Connections", icon: ShieldCheck },
    ],
  },
  { section: "Revenue Cycle", items: [{ key: "claims", path: "/claims", label: "Claims & ERAs", icon: FileCheck2 }] },
  { section: "Insights", items: [{ key: "reports", path: "/reports", label: "Reports", icon: FileText }] },
  {
    section: "Account",
    items: [
      { key: "billing", path: "/billing", label: "Billing & Subscription", icon: CreditCard },
      { key: "notifications", path: "/notifications", label: "Notifications", icon: Bell },
      { key: "security", path: "/security", label: "Security & Settings", icon: Lock },
      { key: "support", path: "/support", label: "Support", icon: LifeBuoy },
    ],
  },
];

export const VIEW_TITLES = {
  dashboard: "Dashboard",
  patients: "Patients",
  clinics: "Clinics",
  staff: "Staff & Roles",
  insurers: "Insurance Connections",
  claims: "Claims & ERAs",
  reports: "Reports",
  billing: "Billing & Subscription",
  notifications: "Notifications",
  security: "Security & Settings",
  support: "Support",
};

export const STATUS_TONE = {
  active: "success",
  trial: "blue",
  invited: "blue",
  deactivated: "neutral",
  not_verified: "neutral",
  queued: "neutral",
  in_progress: "blue",
  completed: "success",
  partial: "warn",
  failed: "danger",
  error: "danger",
  pending: "blue",
  paid: "success",
  overdue: "danger",
  open: "warn",
  closed: "neutral",
  resolved: "success",
  high: "danger",
  medium: "warn",
  low: "neutral",
  draft: "neutral",
  validation_failed: "danger",
  ready: "blue",
  submitting: "blue",
  test_submitted: "blue",
  stedi_accepted: "success",
  stedi_rejected: "danger",
  submission_error: "danger",
};

export const STATUS_LABEL = {
  active: "Active",
  not_verified: "Not verified",
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  partial: "Partial",
  failed: "Failed",
  invited: "Invited",
  deactivated: "Deactivated",
  open: "Open",
  pending: "Pending",
  closed: "Closed",
  resolved: "Resolved",
  draft: "Draft",
  validation_failed: "Validation failed",
  ready: "Ready",
  submitting: "Submitting",
  test_submitted: "Submitted",
  stedi_accepted: "Stedi accepted",
  stedi_rejected: "Stedi rejected",
  submission_error: "Submission error",
};
