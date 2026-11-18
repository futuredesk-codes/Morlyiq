export const modules = [
  "Dashboard",
  "Patients & eligibility",
  "Clinics",
  "Staff & roles",
  "Insurance connections",
  "Claims & remittances",
  "Reports",
  "Billing & subscription",
  "Notifications",
  "Account security",
  "Support",
];

export const roles = [
  { id: "owner", name: "Owner", access: [1,1,1,1,1,1,1,1,1,1,1], blurb: "Practice-wide access, clinic creation, practice security policies and activity history." },
  { id: "manager", name: "Manager", access: [1,1,1,1,1,1,1,0,1,1,1], blurb: "Runs their clinics and permitted staff, but cannot change the Owner or other Managers." },
  { id: "billing", name: "Billing", access: [1,1,0,0,0,1,1,1,1,1,1], blurb: "Submits claims, reviews remittances, reports and the practice subscription." },
  { id: "front", name: "Front Desk", access: [1,1,0,0,0,1,0,0,1,1,1], blurb: "Verifies eligibility and prepares and validates claims. Submission stays with Billing." },
  { id: "dentist", name: "Dentist", access: [1,1,0,0,0,0,0,0,1,1,1], blurb: "Patient and eligibility context, with no financial or claims access through unrelated permissions." },
];
