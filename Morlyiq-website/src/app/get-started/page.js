import GetStartedPage from "@/components/get-started/GetStartedPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Get Started with MorlyIQ",
  description:
    "Learn how MorlyIQ onboarding works from invitation and account activation to adding clinics, staff and completing your first verification.",
  path: "/get-started",
  keywords: [
    "MorlyIQ onboarding",
    "dental software onboarding",
    "dental practice setup",
  ],
});

export default function Page() { return <GetStartedPage />; }
