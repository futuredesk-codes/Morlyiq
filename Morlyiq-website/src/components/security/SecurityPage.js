import DemoSection from "@/components/home/DemoSection";
import SecurityHero from "./SecurityHero";
import SecurityGuarantees from "./SecurityGuarantees";
import SecurityScope from "./SecurityScope";
import AccountSecurity from "./AccountSecurity";

export default function SecurityPage() {
  return (
    <main className="security-page">
      <SecurityHero />
      <SecurityGuarantees />
      <SecurityScope />
      <AccountSecurity />
      <DemoSection />
    </main>
  );
}
