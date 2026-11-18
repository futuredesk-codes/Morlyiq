import LucideIcon from "@/components/LucideIcon";
import { sharedBenefits } from "./pricingData";

export default function PricingBenefits() {
  return (
    <section className="pricing-benefits">
      <span className="pricing-benefits-glow" />
      <div className="section-inner">
        <div className="pricing-benefits-heading">
          <span className="pricing-dark-kicker">EVERY PLAN STARTS HERE</span>
          <h2>The same dependable foundation at every stage.</h2>
        </div>
        <div className="pricing-benefits-grid">
          {sharedBenefits.map(([icon, title, content]) => (
            <article key={title}>
              <span><LucideIcon name={icon} size={25} /></span>
              <div><h3>{title}</h3><p>{content}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
