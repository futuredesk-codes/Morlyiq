"use client";

import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import MotionEffects from "./MotionEffects";

const standaloneRoutes = ["/sign-in"];

export default function SiteChrome({ children }) {
  const pathname = usePathname();
  if (standaloneRoutes.includes(pathname)) return <><MotionEffects />{children}</>;
  return <><MotionEffects /><Header />{children}<Footer /></>;
}
