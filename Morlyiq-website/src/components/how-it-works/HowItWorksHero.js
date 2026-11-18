import WorkflowVisual from "./WorkflowVisual";
import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

export default function HowItWorksHero() {
  return (
    <section className="how-page-hero">
      <div className="how-page-glow how-page-glow-left" />
      <div className="how-page-glow how-page-glow-right" />
      <div className="section-inner how-page-hero-inner">
        <div className="how-page-copy">
          <span className="how-page-label">HOW IT WORKS</span>
          <h1>One flow from <span>check-in to remittance.</span></h1>
          <p>Every step hands clean, validated data to the next — and nothing is marked done until the outcome is confirmed.</p>
          <div className="how-page-actions">
            <Link className="button button-primary" href="/book-demo">Book a demo <LucideIcon name="arrowRight" size={17}/></Link>
            <Link className="button button-secondary" href="/#features">Explore the platform</Link>
          </div>
        </div>
        <WorkflowVisual />
      </div>
    </section>
  );
}
