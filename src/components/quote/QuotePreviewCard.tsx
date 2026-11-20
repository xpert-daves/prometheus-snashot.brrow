'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import clsx from 'clsx';
import { Maximize2 } from 'lucide-react';
import type { DoorSpec, WindowSpec } from '@/components/StructurePreview';
import {
  buildQuoteVisualPreviewParams,
  type QuoteVisualPreviewParams,
} from '@/lib/quoteVisualPlacement';
import { initialQuoteFormParams, type QuoteFormParams } from '@/lib/quoteForm';
import type { QuoteParams } from '@/lib/pricing/calculateQuote';
import type { QuoteApiResponse } from '@/lib/quoteSubmission';
import { useStrokeDraw } from '@/lib/motion';
import { compactMotionAllowed, useCompactViewport } from '@/lib/useCompactViewport';
import { GableProfile } from '@/components/motif/diagrams';
import { PREVIEW_PANEL_HEIGHT, PreviewErrorBoundary } from '@/components/quote/PreviewErrorBoundary';
import { QuoteSelectionSummary } from '@/components/quote/QuoteSelectionSummary';

/**
 * Phones: the tile shimmers at the live canvas size (--qm-preview-h) until the
 * first frame is drawn, so neither the chunk download nor shader compilation
 * shows as an empty sky. The loader is only a spacer over that shimmer.
 */
const phoneShimmer =
  'phone:rounded-(--qm-radius-group) phone:bg-(--qm-fill-2) phone:bg-[linear-gradient(100deg,transparent_30%,rgb(255_255_255/0.08)_50%,transparent_70%)] phone:bg-[length:200%_100%] phone:animate-[qm-skeleton_1.4s_ease-in-out_infinite]';

const StructurePreview = dynamic(() => import('@/components/StructurePreview'), {
  ssr: false,
  loading: () => (
    <div
      className={`w-full animate-pulse rounded-none border border-white/10 bg-black/20 ${PREVIEW_PANEL_HEIGHT} phone:h-(--qm-preview-h) phone:animate-none phone:border-0 phone:bg-transparent`}
    />
  ),
});

/**
 * Phones mount the preview with this stand-in shed while the building list is
 * still showing, hidden in the collapsed card. three.js downloads, compiles its
 * shaders and lights the scene before the pick, so the picked building appears
 * at once instead of after seconds of shimmer.
 */
const WARM_UP_PARAMS = buildQuoteVisualPreviewParams({
  // The first (most picked) building with the defaults a pick applies.
  structureType: 'storage_shed',
  length: 10,
  width: 8,
  roofStyle: 'gabled',
  wallHeight: Number(initialQuoteFormParams.wallHeight) as QuoteParams['wallHeight'],
  color: initialQuoteFormParams.color,
  foundation: initialQuoteFormParams.foundation as QuoteParams['foundation'],
  door: 'single_shed',
  addOns: [],
  deliveryRadius: 0,
});

/** Starts the warm-up once the page is idle, unless data saving is on. */
function scheduleWarmUp(start: () => void) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } })
    .connection;
  if (connection?.saveData) return () => {};
  let idle: number | null = null;
  const timer = window.setTimeout(() => {
    if (typeof window.requestIdleCallback === 'function') {
      idle = window.requestIdleCallback(start, { timeout: 1500 });
    } else {
      start();
    }
  }, 400);
  return () => {
    window.clearTimeout(timer);
    if (idle !== null) window.cancelIdleCallback(idle);
  };
}

function PreviewPlaceholder() {
  const { ref, drawProps } = useStrokeDraw<HTMLDivElement>();

  return (
    <div
      ref={ref}
      {...drawProps}
      className={`flex h-48 flex-col items-center justify-center gap-4 sm:h-56 md:h-64 ${drawProps.className} phone:gap-3`}
    >
      <GableProfile
        className="h-24 w-36 text-white/40 phone:h-16 phone:w-24 phone:text-(--qm-label-3)"
        strokeWidth={1.1}
      />
      <p className="motif-spec text-center text-white/60 phone:qm-subhead phone:text-(--qm-label-2)">
        Choose a structure to preview
      </p>
    </div>
  );
}

/* ---- Phone picture-in-picture dock ------------------------------------------
 * Once the in-flow canvas scrolls under the nav bar on steps 0–1, the SAME
 * StructurePreview (never a second one) docks as a small fixed tile under the
 * nav. Its wrapper keeps the in-flow height, so nothing below moves.
 *
 * The tile is laid out at its real size rather than `transform: scale()`d:
 * R3F measures its container with getBoundingClientRect on every scroll
 * (react-use-measure, scroll: true), so a scaled ancestor would be read back as
 * the canvas size and shrink the drawing buffer inside a full-size box. The
 * tile keeps the card's aspect ratio, so the <Bounds> refit lands on the same
 * framing; the one resize is hidden under the dock fade. Motion only uses
 * opacity/translate, which never change the measured width/height.
 */
const PIP_WIDTH = 132;
const SPRING_FALLBACK = 'cubic-bezier(0.32, 0.72, 0, 1)';

type DockBox = {
  /** The step the dock was made on: any step change undocks in the same render. */
  sheet: string;
  /** In-flow spacer height (px). */
  height: number;
  /** Tile canvas height (px) at PIP_WIDTH with the card's aspect ratio. */
  tileHeight: number;
};

function springEasing(el: Element | null) {
  if (!el) return SPRING_FALLBACK;
  return getComputedStyle(el).getPropertyValue('--qm-ease-spring').trim() || SPRING_FALLBACK;
}

function play(el: HTMLElement, keyframes: Keyframe[], options: KeyframeAnimationOptions) {
  if (typeof el.animate !== 'function') return null;
  try {
    return el.animate(keyframes, options);
  } catch {
    // linear() easing unsupported by this WAAPI build: retry with the bezier.
    try {
      return el.animate(keyframes, { ...options, easing: SPRING_FALLBACK });
    } catch {
      return null;
    }
  }
}

/**
 * The live 3D preview card: canvas (or placeholder), selection summary and the
 * drawing-sheet footer. Desktop renders it in the sticky sidebar.
 *
 * Phones: no card chrome; the whole card stays collapsed (0fr) until a building
 * is picked, then springs open. The canvas is already mounted inside it by then
 * (see WARM_UP_PARAMS), renders on demand at <= 1.5x DPR and stops while
 * off-screen. "Live Preview" is a solid pill over the canvas and the summary is
 * one caption line.
 */
export function QuotePreviewCard({
  draft,
  previewParams,
  onChangeFeatures,
  deliveryZip,
  quote,
  showWallHeight,
  sheetNumber,
  onPreviewError,
  className = '',
}: {
  draft: QuoteFormParams;
  /** Built from the draft; null until a structure is chosen. */
  previewParams: QuoteVisualPreviewParams | null;
  onChangeFeatures: (next: { doors: DoorSpec[]; windows: WindowSpec[] }) => void;
  deliveryZip: string;
  quote: QuoteApiResponse | null;
  showWallHeight: boolean;
  /** e.g. "SHEET 01 / 03" (decorative). */
  sheetNumber: string;
  /** A crashed preview stays inside its box; the page drops its stale feature layout. */
  onPreviewError?: () => void;
  /** Extra classes for the card root (use `phone:` classes for layout on phones). */
  className?: string;
}) {
  const showCanvas = Boolean(draft.structureType && previewParams);
  const compact = useCompactViewport();

  const cardRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLSpanElement>(null);
  const exitRef = useRef<Animation | null>(null);
  const dockedRef = useRef(false);
  const sheetRef = useRef(sheetNumber);
  const dockSheetRef = useRef(sheetNumber);

  const [stageVisible, setStageVisible] = useState(true);
  const [dock, setDock] = useState<DockBox | null>(null);
  const [warm, setWarm] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [failed, setFailed] = useState(false);

  // Steps 0–1 only; any step change or the result screen undocks synchronously.
  const docked =
    compact && showCanvas && !quote && dock !== null && dock.sheet === sheetNumber;
  // Phones keep the (hidden) canvas mounted from the warm-up through the pick.
  const warmCanvas = compact && warm && !showCanvas;
  const mountCanvas = showCanvas || warmCanvas;
  const canvasParams = previewParams ?? WARM_UP_PARAMS;

  useLayoutEffect(() => {
    sheetRef.current = sheetNumber;
  }, [sheetNumber]);

  useEffect(() => {
    if (!compact || warm || showCanvas) return;
    return scheduleWarmUp(() => setWarm(true));
  }, [compact, showCanvas, warm]);

  // A remounted canvas starts over: shimmer until its first frame.
  if (!mountCanvas && firstFrame) setFirstFrame(false);
  const handleFirstFrame = useCallback(() => setFirstFrame(true), []);
  const handlePreviewError = useCallback(() => {
    setFailed(true);
    onPreviewError?.();
  }, [onPreviewError]);

  // Phones: stop the render loop while the canvas is off-screen (and not docked).
  useEffect(() => {
    const stage = stageRef.current;
    if (!compact || !showCanvas || !stage || typeof IntersectionObserver !== 'function') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setStageVisible(entry.isIntersecting);
      },
      { rootMargin: '160px 0px' }
    );
    observer.observe(stage);
    return () => {
      observer.disconnect();
      setStageVisible(true);
    };
  }, [compact, showCanvas]);

  const cancelExit = useCallback(() => {
    exitRef.current?.cancel();
    exitRef.current = null;
  }, []);

  const requestDock = useCallback(() => {
    cancelExit();
    const stage = stageRef.current;
    if (!stage) return;
    const { width, height } = stage.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const sheet = sheetRef.current;
    setDock((current) =>
      current && current.sheet === sheet
        ? current
        : { sheet, height, tileHeight: Math.round(((PIP_WIDTH * height) / width) * 100) / 100 }
    );
  }, [cancelExit]);

  const requestUndock = useCallback(() => {
    const tile = tileRef.current;
    if (!dockedRef.current || !tile) {
      setDock(null);
      return;
    }
    if (exitRef.current) return;
    const exit = compactMotionAllowed()
      ? play(
          tile,
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateY(-8px)' },
          ],
          { duration: 170, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
        )
      : null;
    if (!exit) {
      setDock(null);
      return;
    }
    exitRef.current = exit;
    // fill: forwards keeps the tile hidden until React moves it back in flow.
    // The timer covers a late `finish` event (throttled frames); both are one-shot.
    const done = () => {
      window.clearTimeout(timer);
      if (exitRef.current === exit) setDock(null);
    };
    const timer = window.setTimeout(done, 230);
    exit.onfinish = done;
  }, []);

  // Dock while the in-flow canvas is hidden under the nav. The sentinel sits
  // --qm-nav-h above the canvas bottom (+24px so undocking happens while the
  // canvas is still covered); re-observed on step changes for a fresh reading.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (
      !compact ||
      !showCanvas ||
      quote ||
      !sentinel ||
      typeof IntersectionObserver !== 'function' ||
      !compactMotionAllowed()
    ) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;
      const app = cardRef.current?.closest<HTMLElement>('[data-quote-app]');
      const step = app?.dataset.step ?? '0';
      const stepAllowed = (step === '0' || step === '1') && app?.dataset.result !== 'true';
      const aboveViewport =
        !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
      if (stepAllowed && aboveViewport) requestDock();
      else requestUndock();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [compact, showCanvas, quote, sheetNumber, requestDock, requestUndock]);

  // Dock / undock motion (phones with motion allowed only).
  useLayoutEffect(() => {
    const wasDocked = dockedRef.current;
    const stepChanged = dockSheetRef.current !== sheetNumber;
    dockedRef.current = docked;
    dockSheetRef.current = sheetNumber;
    if (wasDocked === docked) return;
    cancelExit();
    const tile = tileRef.current;
    // A step change undocks inside the screen push: the new screen arrives with
    // its preview already showing, never fading up from black mid-slide.
    if (!tile || !compactMotionAllowed() || stepChanged) return;
    if (docked) {
      play(
        tile,
        [
          { opacity: 0, transform: 'translateY(-14px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 480, easing: springEasing(cardRef.current) }
      );
    } else {
      // Back in flow: fade over the one-frame canvas resize.
      play(tile, [{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
    }
  }, [docked, sheetNumber, cancelExit]);

  useEffect(() => cancelExit, [cancelExit]);

  // The tile (and this button) unmounts once the card is back in view, so park
  // focus on the screen title first instead of letting it fall to <body>.
  const showPreview = useCallback(() => {
    cardRef.current
      ?.closest('[data-quote-app]')
      ?.querySelector<HTMLElement>('#quote-active-step-form h2, h2[tabindex]')
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: compactMotionAllowed() ? 'smooth' : 'instant' });
  }, []);

  // While docked, keyboard and screen-reader focus must not land under the tile:
  // the scroll-padding rule in globals.css adds this height.
  useEffect(() => {
    if (!docked || !dock) return;
    const root = document.documentElement;
    root.style.setProperty('--qm-pip-pad', `${Math.ceil(dock.tileHeight) + 8}px`);
    return () => {
      root.style.removeProperty('--qm-pip-pad');
    };
  }, [dock, docked]);

  const frameloop = compact ? (docked || stageVisible ? 'demand' : 'never') : undefined;
  const liveKey = previewParams ? JSON.stringify(previewParams) : 'none';

  return (
    <div
      ref={cardRef}
      data-quote-preview=""
      data-docked={docked ? 'true' : undefined}
      className={clsx(
        `interior-card relative overflow-hidden p-4 ${className}`,
        // Phones: no chrome; collapsed (0fr) until a building is picked, then springs open.
        // minmax(0,1fr): the canvas's inline px width must not widen the track.
        'phone:grid phone:grid-cols-[minmax(0,1fr)] phone:p-0 phone:transition-[grid-template-rows,opacity,margin-bottom,visibility] phone:duration-[450ms] phone:ease-(--qm-ease-spring)',
        // Collapsed: -mb-6 cancels the shell's phone flex gap-6 so the picker sits under the title.
        showCanvas
          ? 'phone:grid-rows-[1fr]'
          : 'phone:invisible phone:-mb-6 phone:grid-rows-[0fr] phone:opacity-0'
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 motif-grid opacity-50 phone:hidden"
      />
      <div className="relative phone:min-h-0">
        <div className="mb-3 flex items-center justify-between gap-3 phone:pointer-events-none phone:absolute phone:top-3 phone:left-3 phone:z-10 phone:mb-0 phone:h-7 phone:justify-start phone:gap-1.5 phone:rounded-full phone:bg-[rgb(14_14_16/0.58)] phone:px-2.5 phone:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.16),0_4px_12px_-4px_rgb(0_0_0/0.35)]">
          <span
            key={liveKey}
            aria-hidden="true"
            className="hidden phone:block phone:size-1.5 phone:rounded-full phone:bg-(--accent) phone:shadow-[0_0_6px_rgb(var(--accent-glow-rgb)/0.9)] phone:animate-[qm-pop_0.42s_var(--qm-ease-bounce)_both]"
          />
          <span className="motif-spec text-white/60 phone:text-[13px] phone:leading-4 phone:font-semibold phone:tracking-[-0.01em] phone:text-white">
            Live Preview
          </span>
          <span aria-hidden="true" className="motif-spec text-white/30 phone:hidden">
            DWG 210-Q
          </span>
        </div>
        {/* Stage: `contents` (no box) on desktop. Phones: the in-flow slot the tile docks from. */}
        <div
          ref={stageRef}
          data-quote-preview-stage=""
          className="contents phone:relative phone:block"
          style={docked && dock ? { height: dock.height } : undefined}
        >
          {mountCanvas ? (
            <div
              ref={tileRef}
              data-quote-preview-tile=""
              className={clsx(
                'contents phone:block',
                // Shimmer until the first frame, then fade the drawn scene in.
                firstFrame
                  ? 'phone:[&>div>[role=img]]:animate-[qm-fade_0.35s_ease_both]'
                  : 'phone:[&>div>[role=img]]:opacity-0',
                !firstFrame && !failed && phoneShimmer,
                docked &&
                  'phone:fixed phone:top-[calc(var(--qm-nav-h)+8px)] phone:right-4 phone:z-30 phone:w-[132px] phone:rounded-[16px] phone:shadow-[0_16px_36px_-12px_rgb(0_0_0/0.8),0_2px_8px_rgb(0_0_0/0.3)] phone:[--qm-radius-group:16px]'
              )}
              style={
                docked && dock
                  ? ({ '--qm-preview-h': `${dock.tileHeight}px` } as CSSProperties)
                  : undefined
              }
            >
              <PreviewErrorBoundary onError={handlePreviewError}>
                <StructurePreview
                  params={canvasParams}
                  editMode={false}
                  showFeatureControls={false}
                  syncFeaturesFromProps
                  // The stand-in shed must never report its doors and windows as the customer's.
                  onChangeFeatures={showCanvas ? onChangeFeatures : undefined}
                  frameloop={frameloop}
                  maxDpr={compact ? 1.5 : undefined}
                  onFirstFrame={handleFirstFrame}
                />
              </PreviewErrorBoundary>

              {docked ? (
                <button
                  type="button"
                  onClick={showPreview}
                  className="phone:absolute phone:inset-0 phone:z-10 phone:flex phone:items-end phone:justify-end phone:rounded-[16px] phone:p-1.5 phone:shadow-[var(--qm-glass-edge)] phone:transition-colors phone:duration-150 phone:qm-no-select phone:active:scale-100 phone:active:bg-black/25"
                >
                  <span className="sr-only">Show preview</span>
                  <span
                    aria-hidden="true"
                    className="phone:flex phone:size-6 phone:items-center phone:justify-center phone:rounded-full phone:bg-[rgb(14_14_16/0.6)] phone:text-white phone:shadow-[inset_0_0_0_0.5px_rgb(255_255_255/0.2)]"
                  >
                    <Maximize2 className="phone:size-3" strokeWidth={2.5} />
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <PreviewPlaceholder />
          )}
          {compact && showCanvas ? (
            <span
              ref={sentinelRef}
              aria-hidden="true"
              className="pointer-events-none hidden phone:absolute phone:left-0 phone:block phone:h-px phone:w-px phone:top-[calc(100%-var(--qm-nav-h)+24px)]"
            />
          ) : null}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4 phone:mt-2.5 phone:border-t-0 phone:px-1 phone:pt-0">
          <QuoteSelectionSummary
            draft={draft}
            deliveryZip={deliveryZip}
            quote={quote}
            showWallHeight={showWallHeight}
          />
        </div>
        <div
          aria-hidden="true"
          className="motif-spec mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-white/30 phone:hidden"
        >
          <span>Shed210 · San Antonio, TX</span>
          <span className="text-[var(--accent-light)]/70">{sheetNumber}</span>
        </div>
      </div>
    </div>
  );
}
