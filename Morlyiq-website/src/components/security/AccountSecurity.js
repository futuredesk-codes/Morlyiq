const accountCards = [
  ["Secure sign-in", "Sign-in with session management and multi-factor authentication policies where they apply."],
  ["Separate recovery", "Password recovery is its own experience — never mixed with invitations."],
  ["Single-use invitations", "Links expire, name the intended account and become unusable once accepted."],
  ["Protected admin actions", "Sensitive platform changes require password confirmation and an emailed six-digit code."],
];

const reliability = [
  "Loading, success, empty and failure states for important workflows",
  "Completed work preserved; recoverable failures made actionable",
  "No duplicate activity when an action is repeated",
  "Dates and times shown consistently, with a clear time zone",
];

export default function AccountSecurity() {
  return (
    <section className="account-security-section">
      <span className="account-security-orbit" aria-hidden="true"><i className="orbit-moving-dot" /></span>
      <div className="section-inner account-security-inner">
        <div className="account-security-copy">
          <span className="security-dark-kicker">ACCOUNTS</span>
          <h2>Sign-in built for shared front desks.</h2>
          <div className="account-card-grid">{accountCards.map(([title, copy]) => <article key={title}><h3>{title}</h3><p>{copy}</p></article>)}</div>
        </div>
        <div className="security-reliability">
          <span className="security-dark-kicker">RELIABILITY</span>
          <h2>Clear when things go wrong.</h2>
          <ul>{reliability.map((point) => <li key={point}><i><LucideIcon name="check" size={17}/></i><span>{point}</span></li>)}</ul>
        </div>
      </div>
    </section>
  );
}
import LucideIcon from "@/components/LucideIcon";

