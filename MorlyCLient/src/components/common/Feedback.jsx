import React from "react";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { C } from "../../constants/theme";

export function ToastStack({ toasts }) {
  if (!toasts || toasts.length === 0) return null;

  const toneBg = {
    danger: "bg-brand-danger",
    warn: "bg-brand-warn",
    success: "bg-navy",
  };

  return (
    <div className="fixed bottom-[22px] right-[22px] flex flex-col gap-2 z-[999]">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${
            toneBg[t.tone] || "bg-navy"
          } text-white px-4 py-[11px] rounded-[10px] font-sans text-[13.5px] font-medium shadow-toast flex items-center gap-2 min-w-[220px] animate-in fade-in duration-200`}
        >
          {t.tone === "danger" ? (
            <AlertTriangle size={15} />
          ) : (
            <CheckCircle2 size={15} />
          )}
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, text, className = "" }) {
  return (
    <div
      className={`py-10 px-5 text-center text-textFaint font-sans ${className}`}
    >
      <Icon size={26} className="mb-2 mx-auto opacity-60" />
      <div className="text-[13.5px]">{text}</div>
    </div>
  );
}

export function SectionHeader({ title, subtitle, action, className = "" }) {
  return (
    <div
      className={`flex justify-between items-end mb-[18px] flex-wrap gap-3 ${className}`}
    >
      <div>
        <h1 className="font-sans text-[23px] font-extrabold text-brand-text m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="text-textMute font-sans text-[13.5px] mt-1 m-0">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Arc({ value, max, label, sub }) {
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const r = 42;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="104" height="104" viewBox="0 0 104 104">
        <circle cx="52" cy="52" r={r} fill="none" stroke="#DFE6F5" strokeWidth="9" />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="#2F6FED"
          strokeWidth="9"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform="rotate(-90 52 52)"
        />
        <text
          x="52"
          y="49"
          textAnchor="middle"
          fontSize="17"
          fontWeight="600"
          fill="#0F1B33"
          fontFamily="Inter, sans-serif"
        >
          ${value}
        </text>
        <text
          x="52"
          y="65"
          textAnchor="middle"
          fontSize="10"
          fill="#5E6C87"
          fontFamily="Inter, sans-serif"
        >
          of ${max}
        </text>
      </svg>
      <div className="text-center font-sans">
        <div className="font-semibold text-[13px] text-brand-text">
          {label}
        </div>
        <div className="text-[11.5px] text-textMute">{sub}</div>
      </div>
    </div>
  );
}

export function MiniBar({ data, color = C.blue }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-[3px] h-[40px]">
      {data.map((v, i) => (
        <div
          key={i}
          className="w-[6px] rounded-[2px]"
          style={{
            backgroundColor: color,
            opacity: 0.35 + (v / max) * 0.65,
            height: `${Math.max((v / max) * 100, 6)}%`,
          }}
        />
      ))}
    </div>
  );
}

export function Pill({ text, active, onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3.5 py-[7px] rounded-full border text-[12.5px] font-semibold font-sans cursor-pointer transition-colors ${
        active
          ? "border-navy bg-navy text-white"
          : "border-brand-border bg-white text-textMute hover:border-borderStrong"
      } ${className}`}
    >
      {text}
    </button>
  );
}

export function LockedNote({ text = "Restricted to your role", className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-[5px] font-sans text-[11.5px] text-textFaint ${className}`}
    >
      <Lock size={11} />
      {text}
    </div>
  );
}
