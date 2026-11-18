const guarantees = [
  ["shield", "Practice isolation", "No user sees or changes another practice's records without explicit authorization."],
  ["clinic", "Clinic limits everywhere", "Record details, dashboards, search, notifications, reports and downloads all respect clinic scope."],
  ["clock", "Revocation that sticks", "Removed permissions, suspended accounts and expired access stop the next restricted action — even from old links."],
  ["eye", "Need-to-know data", "Sensitive information is available only to users whose work requires it."],
];

function GuaranteeIcon({ type }) { return <LucideIcon name={type === "clinic" ? "building" : type === "shield" ? "shieldCheck" : type} size={28}/>; }

export default function SecurityGuarantees() {
  return (
    <section className="security-guarantees">
      <div className="section-inner">
        <span className="kicker">AUTHORIZATION</span>
        <h2>Four guarantees behind every screen.</h2>
        <div className="security-guarantee-grid">
          {guarantees.map(([icon, title, copy]) => <article key={title}><span><GuaranteeIcon type={icon}/></span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </div>
    </section>
  );
}
import LucideIcon from "@/components/LucideIcon";

