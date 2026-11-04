import React from "react";
import { Search } from "lucide-react";
import { C } from "../../constants/theme.js";

export const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 9,
  border: `1px solid ${C.border}`,
  fontFamily: "Inter, sans-serif",
  fontSize: 13.5,
  color: C.text,
  outline: "none",
  background: "#fff",
};

export function Input({ style, className = "", ...props }) {
  return (
    <input
      {...props}
      className={`focus:border-brand-blue focus:ring-2 focus:ring-brand-blueSoft transition-all ${className}`}
      style={{ ...inputStyle, ...style }}
    />
  );
}

export function Select({ children, style, className = "", ...props }) {
  return (
    <select
      {...props}
      className={`focus:border-brand-blue focus:ring-2 focus:ring-brand-blueSoft transition-all ${className}`}
      style={{ ...inputStyle, ...style }}
    >
      {children}
    </select>
  );
}

export function TextArea({ style, className = "", ...props }) {
  return (
    <textarea
      {...props}
      className={`focus:border-brand-blue focus:ring-2 focus:ring-brand-blueSoft transition-all ${className}`}
      style={{
        ...inputStyle,
        resize: "vertical",
        minHeight: 76,
        ...style,
      }}
    />
  );
}

export function Field({ label, children, hint, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 600,
            color: C.textMute,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: 0.3,
          }}
        >
          {label}
        </div>
      )}
      {children}
      {hint && (
        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 11.5,
            color: C.textFaint,
            marginTop: 5,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

export function CheckRow({ label, checked, onChange, sub, style }) {
  return (
    <label
      className="flex items-start gap-2.5 py-1.5 cursor-pointer select-none"
      style={{
        fontFamily: "Inter, sans-serif",
        ...style,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 w-4 h-4 rounded shrink-0 cursor-pointer"
        style={{ accentColor: C.blue }}
      />
      <span>
        <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 11.5, color: C.textFaint }}>{sub}</div>
        )}
      </span>
    </label>
  );
}

export function Toggle({ on, onChange, label, disabled, style }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="inline-flex items-center gap-2 bg-transparent border-0 select-none transition-opacity"
      style={{
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        color: C.text,
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <span
        style={{
          width: 38,
          height: 21,
          borderRadius: 999,
          background: on ? C.blue : "#D7DEEC",
          position: "relative",
          transition: "background .15s",
          flexShrink: 0,
          display: "inline-block",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: on ? 19 : 2,
            width: 17,
            height: 17,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .15s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
            display: "block",
          }}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search...", style, className = "" }) {
  return (
    <div className={`relative ${className}`} style={{ ...style }}>
      <Search
        size={15}
        color={C.textFaint}
        style={{ position: "absolute", left: 11, top: 10 }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputStyle,
          paddingLeft: 34,
          width: 240,
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
