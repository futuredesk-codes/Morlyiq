const rules = [
  ["clinic", "Only the Owner creates clinics", "Owners and authorized Managers maintain clinic and provider information within their scope."],
  ["people", "Managers manage, within limits", "Managers can manage permitted staff in their clinics — never the Owner or other Managers."],
  ["send", "Submission is restricted", "Owner, Manager and Billing submit claims. Front Desk prepares and validates them."],
  ["eye", "Dentists stay clinical", "Dentists don't receive financial or claims access through unrelated permissions."],
  ["lock", "Practice security is the Owner's", "Practice-wide security policies and activity history are Owner-only."],
  ["key", "Your own account, your control", "Every user manages their own permitted account security settings."],
];

function RuleIcon({ type }) { const names = { clinic: "building", people: "users", send: "send", eye: "eye", lock: "lock", key: "key" }; return <LucideIcon name={names[type]} size={26}/>; }

export default function RoleRulesSection() {
  return (
    <section className="role-rules-section">
      <div className="role-rules-glow" aria-hidden="true" />
      <div className="section-inner">
        <span className="kicker">ROLE RULES</span>
        <h2>Six rules your team can count on.</h2>
        <div className="role-rules-grid">
          {rules.map(([icon, title, copy]) => <article key={title}><span className="rule-icon"><RuleIcon type={icon} /></span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
      </div>
    </section>
  );
}
import LucideIcon from "@/components/LucideIcon";

