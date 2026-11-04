import React from "react";
import { C } from "../../constants/theme.js";

export function Card({ children, style, noPad, className = "" }) {
  return (
    <div
      className={`rounded-2xl transition-shadow ${className}`}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: noPad ? 0 : 20,
        boxShadow: "0 1px 2px rgba(11,59,140,0.04)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action, style }) {
  return (
    <div
      className="flex justify-between items-end mb-4 sm:mb-5 flex-wrap gap-3"
      style={style}
    >
      <div>
        <h1
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 23,
            fontWeight: 800,
            color: C.text,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              color: C.textMute,
              fontFamily: "Inter, sans-serif",
              fontSize: 13.5,
              marginTop: 4,
              marginBottom: 0,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function MiniBar({ data = [], color = C.blue, style }) {
  const max = Math.max(...data, 1);
  return (
    <div
      className="flex items-end gap-[3px] h-10"
      style={style}
    >
      {data.map((v, i) => (
        <div
          key={i}
          className="transition-all duration-300"
          style={{
            width: 6,
            borderRadius: 2,
            background: color,
            opacity: 0.35 + (v / max) * 0.65,
            height: `${Math.max((v / max) * 100, 6)}%`,
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, text, style }) {
  return (
    <div
      className="text-center py-10 px-5 flex flex-col items-center justify-center"
      style={{
        color: C.textFaint,
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      {Icon && <Icon size={26} className="mb-2 opacity-60" />}
      <div style={{ fontSize: 13.5 }}>{text}</div>
    </div>
  );
}
