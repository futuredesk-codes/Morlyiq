import LucideIcon from "@/components/LucideIcon";

const principles = [
  {type:"shield",title:"Confirmed, then complete",text:"No operation shows as successful until its outcome is confirmed."},
  {type:"warning",title:"Outage ≠ coverage result",text:"A provider outage is never confused with a patient’s coverage or a claim rejection."},
  {type:"refresh",title:"No double work",text:"Repeating an action after a delay or interruption won’t create duplicate activity."},
];

function PrincipleIcon({type}) {
  const names = { shield: "shieldCheck", warning: "alert", refresh: "refresh" };
  return <LucideIcon name={names[type]} size={27}/>;
}

export default function PrinciplesSection() {
  return (
    <section className="principles-section">
      <div className="principles-glow" />
      <div className="section-inner">
        <span className="principles-kicker">BUILT-IN PRINCIPLES</span>
        <h2>Reliable when it matters.</h2>
        <div className="principles-grid">
          {principles.map((item) => <article key={item.title}><div className="principle-icon"><PrincipleIcon type={item.type}/></div><h3>{item.title}</h3><p>{item.text}</p></article>)}
        </div>
      </div>
    </section>
  );
}
