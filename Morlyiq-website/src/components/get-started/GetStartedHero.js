import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

const stages = [["1","Invite"],["2","Pay"],["3","Activate"],["4","Set up"]];

export default function GetStartedHero() {
  return <section className="get-started-hero">
    <span className="get-started-glow get-started-glow-left"/><span className="get-started-glow get-started-glow-right"/>
    <div className="section-inner get-started-hero-inner">
      <div className="get-started-hero-copy"><span className="get-started-label">GET STARTED</span><h1>From invitation to <span>first verification.</span></h1><p>MorlyIQ onboarding is invitation-based and payment-confirmed — so your account is set up correctly from the very first login.</p><div className="get-started-actions"><Link className="button button-primary" href="/book-demo">Request an invitation <LucideIcon name="arrowRight" size={17}/></Link><Link className="button button-secondary" href="/sign-in">Sign in</Link></div></div>
      <div className="get-started-stair" aria-hidden="true"><div className="get-started-stair-plane">{stages.map(([number,label],index)=><div key={number} className={`get-stage get-stage-${index+1}`}><b>{number}</b><span>{label}</span></div>)}<span className="finish-flag"><LucideIcon name="flag" size={52}/></span></div></div>
    </div>
  </section>;
}
