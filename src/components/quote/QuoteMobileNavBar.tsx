'use client';

import { useEffect, useRef, useState, type MouseEvent, type Ref } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

/**
 * Phone-only iOS 26 navigation bar for the quote app: transparent with a
 * scroll-edge blur, a 44px glass leading button, an inline title that appears
 * once the screen's large title scrolls under the bar, and step capsules.
 *
 * Everything but the Exit link is aria-hidden: the step heading, the action
 * bar's progressbar and its live step label already describe progress.
 * On steps 1–2 the leading slot stays empty because the action bar's single
 * Back button is positioned there.
 */
export function QuoteMobileNavBar({
  title,
  subtitle,
  progress,
  showExit,
  onExitClick,
  exitLinkRef,
  enabled,
  screenKey,
  getTitleAnchor,
}: {
  title: string;
  subtitle?: string;
  /** Filled capsules, 0–3. */
  progress: number;
  showExit: boolean;
  onExitClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  exitLinkRef?: Ref<HTMLAnchorElement>;
  /** Phone layout is active (tracks the large title only then). */
  enabled: boolean;
  /** Changes whenever a different screen (step or result) is shown. */
  screenKey: number;
  /** The current screen's large title, e.g. the step h2. */
  getTitleAnchor: () => HTMLElement | null;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);
  const [condensedScreen, setCondensedScreen] = useState(screenKey);
  // A new screen opens with its large title showing (the observer below
  // corrects a popped, scrolled screen). Resetting here, not in the observer,
  // keeps the old screen's inline title out of the push's new snapshot.
  if (condensedScreen !== screenKey) {
    setCondensedScreen(screenKey);
    setCondensed(false);
  }

  useEffect(() => {
    if (!enabled) return;
    const bar = barRef.current;
    const anchor = getTitleAnchor();
    if (!bar || !anchor || typeof IntersectionObserver !== 'function') {
      setCondensed(true);
      return;
    }

    const barHeight = bar.offsetHeight;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        // Inline title once the large title has scrolled up under the bar.
        setCondensed(!entry.isIntersecting && entry.boundingClientRect.top < barHeight);
      },
      { rootMargin: `-${barHeight}px 0px 0px 0px`, threshold: 0 }
    );
    observer.observe(anchor);
    return () => observer.disconnect();
  }, [enabled, getTitleAnchor, screenKey]);

  return (
    <div
      ref={barRef}
      data-qm-vt-name="qm-nav"
      className="sticky top-0 z-40 -mx-[var(--qm-gutter)] hidden pt-[env(safe-area-inset-top,0px)] phone:block"
    >
      {/* Scroll-edge effect: blur that fades out below the bar, no hairline. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-5 top-0 bg-linear-to-b from-[var(--qm-bg)]/85 via-[var(--qm-bg)]/50 to-transparent backdrop-blur-md [mask-image:linear-gradient(to_bottom,#000_45%,transparent)]"
      />

      <div className="relative flex h-[52px] items-start gap-2 px-4 pt-2">
        <div className="flex h-11 w-11 shrink-0">
          {showExit ? (
            <Link
              ref={exitLinkRef}
              href="/"
              aria-label="Exit quote"
              onClick={onExitClick}
              className="phone:qm-circle phone:qm-glass phone:qm-animate-fade"
            >
              <X aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.2} />
            </Link>
          ) : null}
        </div>

        {/* Keyed per screen: the new screen's title starts hidden instead of
            transitioning out from the old screen's visible one. */}
        <div
          key={screenKey}
          aria-hidden="true"
          className={`flex h-11 min-w-0 flex-1 flex-col items-center justify-center text-center transition-[opacity,translate] duration-300 ease-[var(--qm-ease-out)] ${
            condensed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          }`}
        >
          <p className="m-0 w-full truncate phone:qm-headline phone:qm-animate-fade">
            {title}
          </p>
          {subtitle ? (
            <p
              className="m-0 w-full truncate text-[var(--qm-label-2)] phone:qm-caption phone:qm-animate-fade"
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        <div aria-hidden="true" className="h-11 w-11 shrink-0" />
      </div>

      <div aria-hidden="true" className="relative flex h-2.5 items-center gap-1.5 px-4">
        {[0, 1, 2].map((index) => {
          const filled = index < progress;
          const current = filled && index === progress - 1 && progress < 3;
          return (
            <span
              key={index}
              className={`relative h-1 flex-1 overflow-hidden rounded-full bg-white/[0.14] transition-shadow duration-500 ${
                current ? 'shadow-[0_0_12px_rgb(var(--accent-glow-rgb)/0.6)]' : ''
              }`}
            >
              <span
                className={`absolute inset-0 origin-left rounded-full bg-[var(--accent)] transition-[scale] duration-500 ease-[var(--qm-ease-spring)] ${
                  filled ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </span>
          );
        })}
      </div>
    </div>
  );
}
