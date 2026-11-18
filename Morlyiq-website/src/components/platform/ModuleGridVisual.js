import LucideIcon from "@/components/LucideIcon";

const modules = [
  ["patients", "users"], ["eligibility", "shieldCheck"], ["claims", "file"],
  ["remittance", "banknote"], ["reports", "chart"], ["clinics", "building"],
  ["notifications", "bell"], ["billing", "card"], ["security", "lock"],
];

export default function ModuleGridVisual() {
  return <div className="module-visual" aria-label="MorlyIQ platform modules"><div className="module-grid">{modules.map(([name, icon], index)=><div className={`module-tile tile-${index+1}`} key={name}><LucideIcon name={icon} size={27}/></div>)}</div></div>;
}
