import React from "react";
import { C } from "../../constants/theme.js";
import { STATUS_TONE, STATUS_LABEL } from "../../constants/navigation.js";

export function Badge({ text, tone = "neutral", style }) {
  const tones = {
    neutral: { fg: C.textMute, bg: "#EEF1F7" },
    blue: { fg: C.navy, bg: C.blueSoft },
    success: { fg: C.success, bg: C.successSoft },
    warn: { fg: C.warn, bg: C.warnSoft },
    danger: { fg: C.danger, bg: C.dangerSoft },
  };
  const t = tones[tone] || tones.neutral;

  return (
    <span
      className="inline-flex items-center"
      style={{
        background: t.bg,
        color: t.fg,
        fontSize: 11.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        fontFamily: "Inter, sans-serif",
        whiteSpace: "nowrap",
        letterSpacing: 0.2,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {text}
    </span>
  );
}

export function StatusBadge({ status, style }) {
  return (
    <Badge
      text={STATUS_LABEL[status] || status}
      tone={STATUS_TONE[status] || "neutral"}
      style={style}
    />
  );
}

export function Pill({ text, active, onClick, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-colors capitalize"
      style={{
        padding: "7px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? C.navy : C.border}`,
        background: active ? C.navy : "#fff",
        color: active ? "#fff" : C.textMute,
        fontFamily: "Inter, sans-serif",
        fontSize: 12.5,
        fontWeight: 600,
        cursor: "pointer",
        ...style,
      }}
    >
      {text}
    </button>
  );
}
