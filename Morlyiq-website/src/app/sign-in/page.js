import SignInPage from "@/components/sign-in/SignInPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Sign In",
  description: "Sign in to your MorlyIQ Client Panel.",
  path: "/sign-in",
  noIndex: true,
});

export default function Page(){ return <SignInPage/>; }
