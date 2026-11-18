import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";
import ModuleGridVisual from "./ModuleGridVisual";

export default function PlatformHero() {
  return (
    <section className="platform-hero">
      <div className="platform-glow platform-glow-left" />
      <div className="platform-glow platform-glow-right" />
      <div className="section-inner platform-hero-inner">
        <div className="platform-hero-copy">
          <span className="platform-label">THE PLATFORM</span>
          <h1>Every front-office module, <span>built around your clinics.</span></h1>
          <p>Patients, eligibility, claims, remittances, reports and billing — in one Client Panel that respects each user&apos;s role and clinic.</p>
          <div className="platform-actions">
            <Link className="button button-primary" href="/book-demo">Book a demo <LucideIcon name="arrowRight" size={17}/></Link>
            <Link className="button button-secondary" href="/how-it-works">See how it works</Link>
          </div>
        </div>
        <ModuleGridVisual />
      </div>
    </section>
  );
}
