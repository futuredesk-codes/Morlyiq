import { siteUrl } from "@/lib/metadata";

const routes = [
  ["", "weekly", 1],
  ["/how-it-works", "monthly", 0.9],
  ["/platform", "monthly", 0.9],
  ["/pricing", "monthly", 0.9],
  ["/roles", "monthly", 0.8],
  ["/security", "monthly", 0.8],
  ["/get-started", "monthly", 0.8],
  ["/book-demo", "monthly", 0.7],
  ["/terms-and-conditions", "yearly", 0.5],
  ["/privacy-policy", "yearly", 0.5],
];

export default function sitemap() {
  return routes.map(([path, changeFrequency, priority]) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
