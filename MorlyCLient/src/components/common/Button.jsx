import React from "react";

export function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  icon: Icon,
  style,
  disabled,
  title,
}) {
  const sizeClasses = {
    sm: "px-[11px] py-[6px] text-[12.5px]",
    md: "px-[15px] py-[9px] text-[13.5px]",
  };

  const variantClasses = {
    primary: "bg-navy text-white hover:opacity-95",
    accent: "bg-brand-blue text-white hover:opacity-95",
    outline: "bg-white text-navy border border-borderStrong hover:bg-slate-50",
    ghost: "bg-transparent text-textMute hover:bg-slate-100",
    danger: "bg-dangerSoft text-brand-danger hover:opacity-90",
    success: "bg-successSoft text-brand-success hover:opacity-90",
    warn: "bg-warnSoft text-brand-warn hover:opacity-90",
  };

  const sClass = sizeClasses[size] || sizeClasses.md;
  const vClass = variantClasses[variant] || variantClasses.primary;

  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[9px] font-sans font-semibold whitespace-nowrap active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${vClass} ${sClass}`}
      style={style}
    >
      {Icon && <Icon size={size === "sm" ? 13 : 14.5} />}
      {children}
    </button>
  );
}

export function IconBtn({ icon: Icon, onClick, tone = "default", title }) {
  const toneClasses = {
    default: "text-textMute hover:bg-blueSoft",
    danger: "text-brand-danger hover:bg-dangerSoft",
    success: "text-brand-success hover:bg-successSoft",
  };

  const tClass = toneClasses[tone] || toneClasses.default;

  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded-[7px] flex items-center justify-center transition-colors bg-transparent border-0 cursor-pointer ${tClass}`}
    >
      <Icon size={15} />
    </button>
  );
}
