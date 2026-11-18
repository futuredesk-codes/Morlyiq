import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

const previewPlans = [
  ["Starter", "$149", "150"],
  ["Growth", "$399", "500"],
  ["Full cycle", "$899", "2,000"],
];

export default function PricingHero() {
  return (
    <section className="pricing-hero">
      <span className="pricing-glow pricing-glow-left" />
      <span className="pricing-glow pricing-glow-right" />
      <div className="section-inner pricing-hero-inner">
        <div className="pricing-hero-copy">
          <span className="pricing-label">PLANS &amp; PRICING</span>
          <h1>Choose the plan that fits <span>your practice today.</span></h1>
          <p>
            Start with eligibility, add claims as you grow, or bring the full revenue cycle into one role-aware workspace.
          </p>
          <div className="pricing-actions">
            <a className="button button-primary" href="#plans">Compare plans <LucideIcon name="arrowRight" size={17} /></a>
            <Link className="button button-secondary" href="/book-demo">Book a demo</Link>
          </div>
          <div className="pricing-proof">
            <span><LucideIcon name="check" size={15} /> Clear usage limits</span>
            <span><LucideIcon name="check" size={15} /> Clinic-aware access</span>
            <span><LucideIcon name="check" size={15} /> Guided onboarding</span>
          </div>
        </div>

        <div className="pricing-preview" aria-label="MorlyIQ plan price preview">
          <span className="pricing-preview-orbit"><i className="orbit-moving-dot" /></span>
          <div className="pricing-preview-card">
            <header>
              <div><small>PLAN OVERVIEW</small><b>Find your starting point</b></div>
              <span>USD</span>
            </header>
            <div className="pricing-preview-list">
              {previewPlans.map(([name, price, usage], index) => (
                <article key={name}>
                  <span className={`pricing-preview-icon preview-${index + 1}`}><LucideIcon name={index === 0 ? "shieldCheck" : index === 1 ? "chart" : "billing"} size={18} /></span>
                  <div><b>{name}</b><small>{usage} verifications</small></div>
                  <strong>{price}</strong>
                </article>
              ))}
            </div>
            <footer><span><i /> Static plan preview</span><b>Custom plan available</b></footer>
          </div>
        </div>
      </div>
    </section>
  );
}
