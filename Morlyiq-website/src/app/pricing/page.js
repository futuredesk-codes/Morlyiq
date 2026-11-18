import PricingPage from "@/components/pricing/PricingPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Plans & Pricing",
  description:
    "Compare MorlyIQ plans for dental eligibility, claims and complete revenue-cycle operations, from early access to enterprise scale.",
  path: "/pricing",
  keywords: [
    "dental software pricing",
    "dental eligibility verification plans",
    "dental claims software cost",
    "dental revenue cycle pricing",
  ],
});

export default function PricingRoute() {
  return <PricingPage />;
}
