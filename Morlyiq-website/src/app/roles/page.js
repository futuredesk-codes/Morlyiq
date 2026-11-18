import RolesPage from "@/components/roles/RolesPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Dental Practice Roles & Access",
  description:
    "Explore MorlyIQ roles, clinic assignments, module access and permission rules for dental owners, managers, billing teams, front desks and dentists.",
  path: "/roles",
  keywords: [
    "dental practice permissions",
    "dental staff roles",
    "clinic access control",
  ],
});

export default function Page() {
  return <RolesPage />;
}
