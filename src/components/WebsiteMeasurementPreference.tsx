"use client";

import { useEffect, useState } from "react";
import { setWebsiteMeasurementDisabled, websiteMeasurementPermitted } from "@/lib/websiteMeasurement";

export default function WebsiteMeasurementPreference() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const refresh = () => setEnabled(websiteMeasurementPermitted());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  function toggle() {
    const saved = setWebsiteMeasurementDisabled(enabled === true);
    setEnabled(websiteMeasurementPermitted());
    setError(!saved);
  }

  return (
    <div className="space-y-3 border border-white/15 p-4">
      <p aria-live="polite">First-party website measurement: {enabled === null ? "checking this browser" : enabled ? "enabled in this browser" : "disabled in this browser"}.</p>
      <button type="button" disabled={enabled === null} onClick={toggle} className="border border-amber-300 px-4 py-2 font-medium text-amber-300 transition hover:bg-amber-300/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300 disabled:opacity-50">
        {enabled === false ? "Enable first-party measurement" : "Disable first-party measurement"}
      </button>
      <p className="text-sm">Global Privacy Control and Do Not Track keep this measurement disabled even if you choose enable. This preference applies to this browser and does not change the existing third-party analytics tools described above.</p>
      {error ? <p role="alert">This browser could not save the preference. Measurement stays disabled when browser storage is unavailable.</p> : null}
    </div>
  );
}
