import React from "react";
import { C } from "../../constants/theme.js";

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon: Icon,
  style,
  disabled,
  title,
  type = "button",
  className = "",
}) {
  const sizes = {
    sm: { pad: "6px 11px", font: 12.5 },
    md: { pad: "9px 15px", font: 13.5 },
  };

  const variants = {
    primary: { bg: C.navy, color: "#fff", border: "none" },
    accent: { bg: C.blue, color: "#fff", border: "none" },
    outline: { bg: "#fff", color: C.navy, border: `1px solid ${C.borderStrong}` },
    ghost: { bg: "transparent", color: C.textMute, border: "none" },
    danger: { bg: C.dangerSoft, color: C.danger, border: "none" },
    success: { bg: C.successSoft, color: C.success, border: "none" },
    warn: { bg: C.warnSoft, color: C.warn, border: "none" },
  };

  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 font-semibold transition-all select-none ${className}`}
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        background: v.bg,
        color: v.color,
        border: v.border,
        borderRadius: 9,
        padding: s.pad,
        fontFamily: "Inter, sans-serif",
        fontSize: s.font,
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 14.5} />}
      {children}
    </button>
  );
}

export function IconBtn({ icon: Icon, onClick, tone = "default", title, style, type = "button", disabled = false }) {
  const tones = {
    default: { color: C.textMute, hover: C.blueSoft },
    danger: { color: C.danger, hover: C.dangerSoft },
    success: { color: C.success, hover: C.successSoft },
  };
  const t = tones[tone] || tones.default;

  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="transition-colors flex items-center justify-center"
      style={{
        background: "transparent",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        color: t.color,
        opacity: disabled ? 0.45 : 1,
        padding: 6,
        borderRadius: 7,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = t.hover;
      }}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <Icon size={15} />
    </button>
  );
}
