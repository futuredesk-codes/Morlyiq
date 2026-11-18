import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

export default function SecurityHero() {
  return (
    <section className="security-page-hero">
      <span className="security-hero-glow security-hero-glow-left" aria-hidden="true" />
      <span className="security-hero-glow security-hero-glow-right" aria-hidden="true" />
      <div className="section-inner security-hero-inner">
        <div className="security-hero-copy">
          <span className="security-page-label">PRIVACY &amp; SECURITY</span>
          <h1>Private by design. <span>Scoped by default.</span></h1>
          <p>Users never see or change another practice&apos;s records without explicit authorization — and clinic restrictions apply everywhere data appears.</p>
          <div className="security-hero-actions">
            <Link className="button button-primary" href="/book-demo">Book a demo <LucideIcon name="arrowRight" size={17}/></Link>
            <Link className="button button-secondary" href="/roles">How roles work</Link>
          </div>
        </div>
        <div className="security-shield-visual lock-orbit-stage" aria-hidden="true">
          <span className="lock-orbit lock-orbit-outer"><i className="lock-orbit-dot" /></span>
          <span className="lock-orbit lock-orbit-inner"><i className="lock-orbit-dot" /></span>
          <svg className="security-main-shield" viewBox="0 0 100 116">
            <defs><linearGradient id="securityShieldGradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#4f7df5"/><stop offset="100%" stopColor="#16307a"/></linearGradient></defs>
            <path d="M50 4 92 20v34c0 28-18 48-42 58C26 102 8 82 8 54V20Z" fill="url(#securityShieldGradient)" />
            <path d="M50 4 92 20v34c0 28-18 48-42 58Z" fill="#7fa2ff" opacity=".4" />
            <rect x="34" y="50" width="32" height="26" rx="5" fill="#fff" />
            <path d="M40 50v-8a10 10 0 0 1 20 0v8" fill="none" stroke="#fff" strokeWidth="5" />
            <circle cx="50" cy="61" r="4" fill="#1b3a8c" /><rect x="48.5" y="62" width="3" height="8" rx="1.5" fill="#1b3a8c" />
          </svg>
          <span className="security-chip security-mfa-chip"><LucideIcon name="key" size={18}/><b>MFA on</b></span>
          <span className="security-chip security-clinic-chip"><LucideIcon name="building" size={18}/><b>Uptown clinic only</b></span>
        </div>
      </div>
    </section>
  );
}
