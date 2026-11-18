import DashboardScene from "./DashboardScene";
import LucideIcon from "@/components/LucideIcon";

export default function HeroSection() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow hero-glow-right" /><div className="hero-glow hero-glow-left" />
      <div className="floor-grid" aria-hidden="true" />
      <div className="section-inner hero-inner">
        <div className="hero-copy">
          <div className="eyebrow-pill"><b>NEW</b><span>Dental insurance verification &amp; revenue cycle</span></div>
          <h1>Verify coverage. File cleaner claims. <span>See what actually got paid.</span></h1>
          <p>MorlyIQ brings eligibility checks, dental claims and remittance review into one workspace — for practices with one clinic or many, scoped to every role on your team.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="/book-demo">Book a demo <LucideIcon name="arrowRight" size={17}/></a>
            <a className="button button-secondary" href="#how"><span className="play"><LucideIcon name="play" size={13}/></span> See how it works</a>
          </div>
          <div className="proof-list">
            {["Real-time eligibility via Stedi", "Multi-clinic by design", "Role-based access"].map((item) => <span key={item}><i><LucideIcon name="check" size={13}/></i>{item}</span>)}
          </div>
        </div>
        <DashboardScene />
      </div>
    </section>
  );
}
