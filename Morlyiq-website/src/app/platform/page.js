import PlatformPage from "@/components/platform/PlatformPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Dental Front-Office Platform",
  description:
    "Explore MorlyIQ modules for patients, eligibility, claims, remittances, reporting, billing and multi-clinic operations.",
  path: "/platform",
  keywords: [
    "dental front office platform",
    "dental billing software",
    "multi-clinic dental operations",
    "dental reporting software",
  ],
});

export default function PlatformRoute() {
  return <PlatformPage />;
}
