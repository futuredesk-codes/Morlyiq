import LucideIcon from "@/components/LucideIcon";

const steps = [
  ["mail", "Your invitation arrives", "A MorlyIQ administrator invites the practice Owner and selects your plan. The invitation names your account before anything else."],
  ["card", "Confirm your subscription", "Review the invitation and complete the required payment. An interrupted checkout never activates a paid plan."],
  ["key", "Activate your account", "Confirmed payment lets you create your password and open the Client Panel."],
  ["userPlus", "Add clinics and invite staff", "Create a clinic, add provider details and invite your team by email with a role for each clinic."],
];
const inviteRules = ["Invitations identify the intended account and access before you set a password","Links expire, and stop working once they've been accepted","An accepted invitation can't be reused to change your password","Expired or replaced invitations explain what happened and how to get a new one"];

export default function OnboardingSteps() {
  return <section className="onboarding-steps-section"><div className="section-inner onboarding-steps-layout"><div><span className="kicker">FOUR STEPS</span><h2>Here&apos;s exactly what to expect.</h2><div className="onboarding-timeline">{steps.map(([icon,title,copy],index)=><article key={title}><span className={`timeline-icon ${index===3?"active":""}`}><LucideIcon name={icon} size={28}/></span><div><small>STEP {index+1}</small><h3>{title}</h3><p>{copy}</p></div></article>)}</div></div><aside className="invitation-card"><span className="invitation-icon"><LucideIcon name="mail" size={28}/></span><h3>Invitations that behave</h3><ul>{inviteRules.map(rule=><li key={rule}><i><LucideIcon name="check" size={17}/></i><span>{rule}</span></li>)}</ul></aside></div></section>;
}
