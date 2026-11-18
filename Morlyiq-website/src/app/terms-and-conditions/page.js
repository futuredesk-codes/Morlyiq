import LegalDocumentPage from "@/components/legal/LegalDocumentPage";
import { termsSections } from "@/components/legal/legalData";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Terms & Conditions",
  description: "Read the terms that govern access to the MorlyIQ website and dental insurance verification and revenue-cycle platform.",
  path: "/terms-and-conditions",
  keywords: ["MorlyIQ terms", "dental software terms", "MorlyIQ conditions of use"],
});

export default function TermsRoute() {
  return <LegalDocumentPage eyebrow="LEGAL" title="Terms & Conditions" intro="These terms explain the rules for using the MorlyIQ website and platform, including accounts, subscriptions, insurance information and third-party services." icon="file" sections={termsSections} />;
}