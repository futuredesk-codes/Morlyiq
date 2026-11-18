import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";
import { plans } from "./pricingData";

export default function PricingPlansSection() {
  return (
    <section className="pricing-plans-section" id="plans">
      <div className="section-inner">
        <div className="pricing-section-heading">
          <div>
            <span className="kicker">FLEXIBLE PLANS</span>
            <h2>A clear path from first check to full revenue cycle.</h2>
          </div>
          <p>Prices and limits are shown in USD. Plan availability is confirmed during onboarding.</p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`pricing-card${plan.featured ? " featured" : ""}${plan.dark ? " dark" : ""}`} key={plan.id}>
              {plan.featured && <span className="pricing-popular">MOST POPULAR</span>}
              <div className="pricing-card-top">
                <span className="pricing-plan-icon"><LucideIcon name={plan.icon} size={24} /></span>
                <span className="pricing-plan-label">{plan.label}</span>
              </div>
              <h3>{plan.name}</h3>
              <p className="pricing-description">{plan.description}</p>
              <div className="pricing-price">
                <strong>{plan.price}</strong>
                <span>for {plan.period}</span>
              </div>
              <div className="pricing-usage">
                <span><small>USAGE LIMIT</small><b>{plan.usage}</b></span>
                <span><small>FEATURES</small><b>{plan.featureCount}</b></span>
              </div>
              <ul>
                {plan.features.map((feature) => (
                  <li key={feature}><i><LucideIcon name="check" size={14} /></i><span>{feature}</span></li>
                ))}
              </ul>
              <Link className="pricing-card-cta" href={plan.href}>{plan.cta} <LucideIcon name="arrowRight" size={17} /></Link>
            </article>
          ))}
        </div>

        <p className="pricing-note">
          Usage means completed eligibility verifications during the displayed plan period. Final scope, billing and activation details are confirmed before payment.
        </p>
      </div>
    </section>
  );
}
