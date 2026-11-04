import React from "react";

export function Card({ children, className = "", style, noPad }) {
  return (
    <div
      className={`bg-white border border-brand-border rounded-[14px] shadow-card ${
        noPad ? "p-0" : "p-5"
      } ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
