import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { privacySections } from "@/components/legal/legalData";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Privacy Policy",
  description: "Learn what information MorlyIQ collects, why it is used, when it is shared and the choices available to website and platform users.",
  path: "/privacy-policy",
  keywords: ["MorlyIQ privacy", "dental software privacy policy", "patient data privacy"],
});

export default function PrivacyRoute() {
  return <LegalDocumentPage eyebrow="PRIVACY" title="Privacy Policy" intro="This policy describes how MorlyIQ handles information across our public website, account onboarding and dental operations platform." icon="shieldCheck" sections={privacySections} />;
}