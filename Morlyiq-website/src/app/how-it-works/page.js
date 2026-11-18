import HowItWorksHero from "@/components/how-it-works/HowItWorksHero";
import WorkflowStepsSection from "@/components/how-it-works/WorkflowStepsSection";
import PrinciplesSection from "@/components/how-it-works/PrinciplesSection";
import DemoSection from "@/components/home/DemoSection";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "How It Works: Verification to Remittance",
  description:
    "See how MorlyIQ connects eligibility verification, dental claims and remittance reconciliation in one continuous workflow.",
  path: "/how-it-works",
  keywords: [
    "dental claim workflow",
    "patient eligibility workflow",
    "dental remittance matching",
  ],
});

export default function HowItWorksPage() {
  return (
    <main className="how-page">
      <HowItWorksHero />
      <WorkflowStepsSection />
      <PrinciplesSection />
      <DemoSection />
    </main>
  );
}
