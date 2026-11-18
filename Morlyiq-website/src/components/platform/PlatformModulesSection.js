const modules=[
  ["Patients & eligibility","Create, search and update patients within your clinics, then verify coverage in a click.",["Identity, payer, member and group details","CSV import with row-level errors","Future dates of birth blocked"]],
  ["Claims","Dental claim drafts with validation before anything is submitted.",["Patient, insurance and procedure details","Current eligibility required","Acceptance shown apart from payment"]],
  ["Remittances & documents","Review payment and adjustment details from available ERAs.",["Matched by claim and clinic reference","Unmatched results explained","Exports respect your access"]],
  ["Clinics & providers","Clinic contacts, addresses and billing provider details in one place.",["Provider identifier and taxonomy","Insurance connection per clinic","Missing claim information flagged"]],
  ["Staff & roles","Invite by email, assign clinics and pick a role for each assignment.",["Pending invitations stay separate","Different roles at different clinics","Access changes apply immediately"]],
  ["Reports","Reporting that reflects your authorized clinics and filters.",["Built from recorded activity","Unavailable measures labelled","Scoped to visible clinics"]],
  ["Billing & subscription","Plan, subscription status and billing information for Owners and Billing.",["Limits explain the next step","Billing stays open after trial","Usage shown against plan"]],
  ["Notifications & support","Alerts and tickets tuned to your practice, clinic and role.",["Read status and preferences","Create and follow tickets","Support available in context"]],
];
const iconNames=["users","file","banknote","building","userCog","chart","billing","bell"];
export default function PlatformModulesSection(){return <section className="platform-modules"><div className="section-inner"><div className="platform-section-heading"><span className="kicker">MODULES</span><h2>Eight modules. One place to work.</h2></div><div className="platform-modules-grid">{modules.map(([title,text,bullets],index)=><article key={title}><div className="platform-module-icon"><LucideIcon name={iconNames[index]} size={28}/></div><h3>{title}</h3><p>{text}</p><ul>{bullets.map(item=><li key={item}><i><LucideIcon name="check" size={15}/></i><span>{item}</span></li>)}</ul></article>)}</div></div></section>}
import LucideIcon from "@/components/LucideIcon";

