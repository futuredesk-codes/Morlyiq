import React from "react";
import { STATUS_LABEL, STATUS_TONE } from "../../constants/rbac";

export function Badge({ text, tone = "neutral", className = "" }) {
  const tones = {
    neutral: "bg-[#EEF1F7] text-textMute",
    blue: "bg-blueSoft text-navy",
    success: "bg-successSoft text-brand-success",
    warn: "bg-warnSoft text-brand-warn",
    danger: "bg-dangerSoft text-brand-danger",
  };

  const toneClass = tones[tone] || tones.neutral;

  return (
    <span
      className={`inline-block font-sans text-[11.5px] font-bold px-[9px] py-[3px] rounded-full whitespace-nowrap tracking-[0.2px] uppercase ${toneClass} ${className}`}
    >
      {text}
    </span>
  );
}

export function StatusBadge({ status, className = "" }) {
  return (
    <Badge
      text={STATUS_LABEL[status] || status}
      tone={STATUS_TONE[status] || "neutral"}
      className={className}
    />
  );
}
