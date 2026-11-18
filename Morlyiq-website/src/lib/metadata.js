export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://morlyiq.com";

const sharedKeywords = [
  "dental insurance verification",
  "dental revenue cycle management",
  "dental claims software",
  "dental eligibility verification",
  "dental practice management",
];

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
}) {
  return {
    title,
    description,
    keywords: [...new Set([...keywords, ...sharedKeywords])],
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      siteName: "MorlyIQ",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
