import HomePage from "@/components/home/HomePage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Dental Insurance Verification & Revenue Cycle",
  description:
    "Verify coverage, prepare cleaner dental claims and reconcile remittances across every clinic in one connected MorlyIQ workspace.",
  path: "/",
  keywords: [
    "dental front office software",
    "multi-clinic dental software",
    "dental remittance reconciliation",
  ],
});

export default function Home() {
  return <HomePage />;
}
