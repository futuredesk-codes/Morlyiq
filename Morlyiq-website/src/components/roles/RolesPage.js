import DemoSection from "@/components/home/DemoSection";
import RolesHero from "./RolesHero";
import RolePickerSection from "./RolePickerSection";
import PermissionsTableSection from "./PermissionsTableSection";
import RoleRulesSection from "./RoleRulesSection";

export default function RolesPage() {
  return (
    <main className="roles-page">
      <RolesHero />
      <RolePickerSection />
      <PermissionsTableSection />
      <RoleRulesSection />
      <DemoSection />
    </main>
  );
}
