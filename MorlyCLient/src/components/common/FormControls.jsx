import React from "react";
import { Search } from "lucide-react";

export function Field({ label, children, hint, required = false, className = "" }) {
  return (
    <div className={`mb-3.5 ${className}`}>
      <div className="font-sans text-[12px] font-semibold text-textMute mb-1.5 uppercase tracking-[0.3px]">
        {label}{required && <span className="ml-1 text-brand-danger" aria-hidden="true">*</span>}
      </div>
      {children}
      {hint && (
        <div className="font-sans text-[11.5px] text-textFaint mt-1">
          {hint}
        </div>
      )}
    </div>
  );
}

const baseInputClasses =
  "px-3 py-[9px] rounded-[9px] border border-brand-border font-sans text-[13.5px] text-brand-text outline-none bg-white focus:border-brand-blue focus:ring-2 focus:ring-blueSoft transition-colors";

export function Input({ className = "", ...props }) {
  return <input className={`w-full ${baseInputClasses} ${className}`} {...props} />;
}

export function Select({ children, className = "", style, ...props }) {
  return (
    <select
      className={`${baseInputClasses} cursor-pointer ${className}`}
      style={style}
      {...props}
    >
      {children}
    </select>
  );
}

export function TextArea({ className = "", ...props }) {
  return (
    <textarea
      className={`w-full ${baseInputClasses} resize-y min-h-[76px] ${className}`}
      {...props}
    />
  );
}

export function Toggle({ on, onChange, label, disabled, className = "" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-2 bg-transparent border-0 cursor-pointer font-sans text-[13px] text-brand-text disabled:opacity-55 disabled:cursor-not-allowed ${className}`}
    >
      <span
        className={`w-[38px] h-[21px] rounded-full relative transition-colors duration-150 shrink-0 ${
          on ? "bg-brand-blue" : "bg-[#D7DEEC]"
        }`}
      >
        <span
          className={`absolute top-[2px] w-[17px] h-[17px] rounded-full bg-white transition-all duration-150 shadow-[0_1px_3px_rgba(0,0,0,0.25)] ${
            on ? "left-[19px]" : "left-[2px]"
          }`}
        />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

export function SearchBox({ value, onChange, placeholder = "Search...", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={15}
        className="absolute left-[11px] top-[10px] text-textFaint"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-[240px] pl-[34px] ${baseInputClasses} ${className}`}
      />
    </div>
  );
}
