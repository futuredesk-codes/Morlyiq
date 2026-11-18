import "./globals.css";
import SiteChrome from "@/components/SiteChrome";
import { siteUrl } from "@/lib/metadata";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MorlyIQ | Dental Insurance Verification & Revenue Cycle",
    template: "%s | MorlyIQ",
  },
  description:
    "Verify dental coverage, build cleaner claims and review remittances across every clinic and role in one workspace.",
  applicationName: "MorlyIQ",
  authors: [{ name: "MorlyIQ" }],
  creator: "MorlyIQ",
  publisher: "MorlyIQ",
  category: "Dental practice software",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
