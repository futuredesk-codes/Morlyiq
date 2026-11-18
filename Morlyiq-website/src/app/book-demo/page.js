import BookDemoPage from "@/components/book-demo/BookDemoPage";
import { createPageMetadata } from "@/lib/metadata";

export const metadata = createPageMetadata({
  title: "Book a Dental Workflow Demo",
  description:
    "Book a tailored MorlyIQ walkthrough for your dental practice, clinics and team roles.",
  path: "/book-demo",
  keywords: [
    "dental software demo",
    "dental eligibility software demo",
    "dental claims platform demo",
  ],
});
export default function Page(){ return <BookDemoPage/>; }
