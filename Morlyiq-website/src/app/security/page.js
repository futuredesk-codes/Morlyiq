import SecurityPage from "@/components/security/SecurityPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Privacy & Security",
  description:
    "See how MorlyIQ scopes access by practice and clinic, protects accounts and keeps dental practice records private.",
  path: "/security",
  keywords: [
    "dental data security",
    "dental software privacy",
    "clinic-scoped access",
    "dental account security",
  ],
});

export default function Page() {
  return <SecurityPage />;
}
