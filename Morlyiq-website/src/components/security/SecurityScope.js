const scopePoints = [
  "A practice can hold many clinics; staff only see the clinics they're assigned to",
  "Staff can hold different roles at different clinics",
  "Changing the active clinic updates records, summaries and available actions",
  "Combined exports and documents never include records outside your access",
];

export default function SecurityScope() {
  return (
    <section className="security-scope-section">
      <div className="section-inner security-scope-inner">
        <div className="scope-layers" aria-hidden="true">
          <article className="scope-layer scope-records"><b>Records</b><span>Patients · claims · ERAs · documents</span></article>
          <article className="scope-layer scope-clinics"><b>Clinics</b><span>Uptown · Riverside · Lakeview</span></article>
          <article className="scope-layer scope-practice"><b>Practice</b><span>Owner-level policies &amp; history</span></article>
        </div>
        <div className="security-scope-copy">
          <span className="security-dark-kicker">SCOPE</span>
          <h2>Scope follows every user, layer by layer.</h2>
          <ul>{scopePoints.map((point) => <li key={point}><i><LucideIcon name="check" size={17}/></i><span>{point}</span></li>)}</ul>
        </div>
      </div>
    </section>
  );
}
import LucideIcon from "@/components/LucideIcon";

