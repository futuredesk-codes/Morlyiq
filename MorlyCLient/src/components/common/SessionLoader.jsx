import React from "react";
import { LOGO_ICON } from "../../constants/theme";

export function SessionLoader() {
  return (
    <div
      className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#F4F7FD]/60 px-5 font-sans backdrop-blur-[3px]"
      role="status"
      aria-live="polite"
      aria-label="Verifying secure connection"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2F6FED]/10 blur-[85px] sm:h-[380px] sm:w-[380px]" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative mb-6 h-[116px] w-[116px]">
          <div className="absolute inset-2 animate-pulse rounded-full bg-[#2F6FED]/15 blur-xl motion-reduce:animate-none" />
          <div
            className="absolute inset-0 animate-spin rounded-full motion-reduce:animate-none"
            style={{ background: "conic-gradient(from 20deg, transparent 0 24%, #2F6FED 42%, #0B3B8C 59%, transparent 76%)" }}
          >
            <div className="absolute inset-[3px] rounded-full bg-[#F4F7FD]" />
          </div>
          <div className="absolute inset-[13px] animate-[spin_2.4s_linear_infinite_reverse] rounded-full border border-dashed border-[#AFC5F3] motion-reduce:animate-none" />
          <div className="absolute inset-[25px] flex items-center justify-center overflow-hidden rounded-full border border-[#DFE6F5] bg-white shadow-[0_10px_30px_rgba(47,111,237,0.18)]">
            <img src={LOGO_ICON} alt="MorlyIQ" className="h-full w-full rounded-full object-contain p-3" />
          </div>
          <span className="absolute left-1/2 top-[-3px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#2F6FED] shadow-[0_0_0_5px_rgba(47,111,237,0.12),0_0_16px_rgba(47,111,237,0.55)]" />
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[1.2px] text-[#5E6C87]">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2F6FED] opacity-40 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#2F6FED]" />
          </span>
          Verifying secure connection
        </div>
      </div>
    </div>
  );
}
