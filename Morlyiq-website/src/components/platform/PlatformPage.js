import PlatformHero from "./PlatformHero";
import PlatformModulesSection from "./PlatformModulesSection";
import PlatformDashboardSection from "./PlatformDashboardSection";
import DemoSection from "@/components/home/DemoSection";

export default function PlatformPage() {
  return (
    <main className="platform-page">
      <PlatformHero />
      <PlatformModulesSection />
      <PlatformDashboardSection />
      <DemoSection />
    </main>
  );
}
