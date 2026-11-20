"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createWebsiteMeasurementTracker } from "@/lib/websiteMeasurement";

export default function WebsiteMeasurementProvider() {
  const pathname = usePathname();
  const tracker = useRef<ReturnType<typeof createWebsiteMeasurementTracker> | null>(null);

  useEffect(() => {
    tracker.current ??= createWebsiteMeasurementTracker();
    return tracker.current.connect();
  }, []);

  useEffect(() => { if (pathname) tracker.current?.pageView(pathname); }, [pathname]);

  return null;
}
