import LucideIcon from "@/components/LucideIcon";
function StepIcon({type}){const names={verify:"shieldCheck",claim:"file",submit:"send",payment:"banknote"};return <LucideIcon name={names[type]||"banknote"} size={30}/>}

const steps=[
  ["01","verify","Verify eligibility","Check coverage through the configured provider. See the payer response, time, and a clear completed, partial or failed outcome."],
  ["02","claim","Build the claim","Draft with patient, provider and procedure data. Actionable validation errors appear before anything leaves the building."],
  ["03","submit","Submit & track","Submission needs a current, successful eligibility result. Track progress, acceptance or rejection with response details."],
  ["04","era","Reconcile ERAs","Refresh remittances and match each one to its claim and clinic by claim reference. Unmatched results are explained, not hidden."],
];

export default function HowItWorksSection(){return <section className="how-section" id="how"><div className="section-inner">
  <div className="how-heading"><div><span className="kicker">HOW IT WORKS</span><h2>From front desk to<br/>remittance, one continuous<br/>flow.</h2></div><p>Less re-keying between portals. Each step hands clean, validated data to the next — and nothing is marked done until the outcome is confirmed.</p></div>
  <div className="how-steps">{steps.map(([no,type,title,text])=><article className="how-card" key={no}><div className="how-icon"><StepIcon type={type}/></div><span className="how-number">{no}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
  </div></section>}
