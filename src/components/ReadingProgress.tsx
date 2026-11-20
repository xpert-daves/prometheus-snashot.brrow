"use client";

import { useEffect, useState } from "react";

type Props = {
  targetId?: string; // id of the element to track within; defaults to document.body
  height?: number; // px
  className?: string;
};

export default function ReadingProgress({ targetId, height = 3, className }: Props) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = targetId ? document.getElementById(targetId) : document.body;
    if (!el) return;

    const onScroll = () => {
      const total = el.scrollHeight - window.innerHeight;
      const scrolled = Math.min(total, Math.max(0, window.scrollY - (el as HTMLElement).offsetTop));
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      setProgress(Math.max(0, Math.min(100, pct)));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetId]);

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-x-0 top-0 z-30 bg-transparent ${className || ""}`}
      style={{ pointerEvents: "none", height }}
    >
      <div
        className="h-full w-0 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
