import React, { useCallback, useEffect, useState } from "react";
import { useApp } from "../../store/useApp.js";
import { API_BASE } from "../../services/http.js";
import { LOGO_ICON } from "../../constants/logo.js";

export function PlatformAvailability({ children }) {
  const { platformSettings, setPlatformSettings } = useApp();
  const [error, setError] = useState("");
  const maintenance = platformSettings?.maintenanceMode === true;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/client-panel/platform`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error("Could not load platform status");
      setPlatformSettings(payload.data);
      setError("");
    } catch { setError("Cannot reach MorlyIQ. Please check your connection and try again."); }
  }, [setPlatformSettings]);

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    const onMaintenance = (event) => setPlatformSettings(event.detail);
    void refresh();
    // Normal operation uses existing API responses and tab focus to detect
    // maintenance. Poll only the maintenance screen so it can recover itself.
    const timer = maintenance ? setInterval(onVisible, 60_000) : null;
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("morlyiq:maintenance", onMaintenance);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("morlyiq:maintenance", onMaintenance); };
  }, [refresh, setPlatformSettings, maintenance]);

  if (!platformSettings || platformSettings.maintenanceMode) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6 font-sans">
      <main className="max-w-lg w-full rounded-2xl bg-white border border-slate-200 p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-blue-100 bg-white p-4 shadow-[0_8px_24px_rgba(47,111,237,0.12)] ring-4 ring-blue-50">
          <img src={LOGO_ICON} alt="MorlyIQ logo" className="h-full w-full object-contain" />
        </div>
        <div className="font-bold text-blue-900 mb-4">MorlyIQ</div>
        <h1 className="text-xl font-bold mb-3">{platformSettings?.maintenanceMode ? "Scheduled maintenance" : error ? "Unable to connect" : "Checking platform availability..."}</h1>
        {platformSettings?.maintenanceMode && <p className="text-slate-600 mb-4">We are making updates. Please try again shortly.</p>}
        {error && <p role="alert" className="text-sm text-red-700 mb-4">{error}</p>}
        {platformSettings?.supportEmail && <p className="text-sm mb-4">Need help? <a className="text-blue-700 underline" href={`mailto:${platformSettings.supportEmail}`}>{platformSettings.supportEmail}</a></p>}
        {(error || platformSettings?.maintenanceMode) && <button className="rounded-lg bg-blue-900 px-4 py-2 text-white" onClick={refresh}>Check again</button>}
      </main>
    </div>
  );
  return children;
}
