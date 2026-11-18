import PricingHero from "./PricingHero";
import PricingPlansSection from "./PricingPlansSection";
import PricingBenefits from "./PricingBenefits";
import DemoSection from "@/components/home/DemoSection";

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <PricingHero />
      <PricingPlansSection />
      <PricingBenefits />
      <DemoSection />
    </main>
  );
}
