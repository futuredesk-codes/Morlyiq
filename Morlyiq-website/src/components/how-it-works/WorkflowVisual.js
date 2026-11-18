import LucideIcon from "@/components/LucideIcon";

const stages = [
  ["Eligibility completed", "Coverage verified", "green"],
  ["Claim submitted", "Validated and sent", "blue"],
  ["Remittance received", "Payer response posted", "gold"],
  ["Matched to claim", "Outcome confirmed", "mint"],
];

export default function WorkflowVisual() {
  return (
    <div className="workflow-visual" aria-label="MorlyIQ workflow from eligibility to claim matching">
      <div className="workflow-plane" />
      <div className="workflow-stack">
        {stages.map(([title, detail, color], index) => (
          <div className={`workflow-stage stage-${index + 1}`} key={title}>
            <i className={color} />
            <span><b>{title}</b><small>{detail}</small></span>
            {index === stages.length - 1 && <em><LucideIcon name="check" size={13}/></em>}
          </div>
        ))}
      </div>
    </div>
  );
}
