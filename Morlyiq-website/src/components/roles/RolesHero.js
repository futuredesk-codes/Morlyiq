import Link from "next/link";
import LucideIcon from "@/components/LucideIcon";

const orbitRoles = ["Owner", "Manager", "Billing", "Front Desk", "Dentist"];

export default function RolesHero() {
  return (
    <section className="roles-hero">
      <span className="roles-glow roles-glow-left" aria-hidden="true" />
      <span className="roles-glow roles-glow-right" aria-hidden="true" />
      <div className="section-inner roles-hero-inner">
        <div className="roles-hero-copy">
          <span className="roles-label">ROLES &amp; ACCESS</span>
          <h1>Access that <span>matches the job.</span></h1>
          <p>Five Client Panel roles, assigned per clinic. Module access always follows clinic assignment, record ownership, account status and subscription.</p>
          <div className="roles-hero-actions">
            <Link className="button button-primary" href="/book-demo">Book a demo <LucideIcon name="arrowRight" size={17}/></Link>
            <Link className="button button-secondary" href="/#security">Security details</Link>
          </div>
        </div>
        <div className="role-orbit-visual" aria-hidden="true">
          <div className="role-orbit-disc">
            <i className="orbit-moving-dot" />
            <span className="role-orbit-line role-orbit-line-inner"><i className="orbit-moving-dot is-mint" /></span>
            <div className="role-orbit-center">
              <LucideIcon name="building" size={27}/>
              <b>Practice</b>
            </div>
            {orbitRoles.map((role, index) => <span key={role} className={`orbit-role orbit-role-${index + 1}`}>{role}</span>)}
          </div>
        </div>
      </div>
    </section>
  );
}
