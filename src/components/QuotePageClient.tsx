'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react';
import { flushSync } from 'react-dom';
import clsx from 'clsx';
import type { QuoteParams } from '@/lib/pricing/calculateQuote';
import {
  getQuoteBlockingField,
  QUOTE_STEP_LABELS,
  type QuoteDraft,
  type QuoteFlowStep,
} from '@/lib/quoteFlow';
import { roofLabels } from '@/lib/quoteForm';
import { useQuoteFlow } from '@/lib/useQuoteFlow';
import { trackQuoteStepInClarity, trackWebsiteEvent } from '@/lib/websiteMeasurement';
import { triggerHaptic } from '@/lib/haptics';
import {
  compactMotionAllowed,
  isCompactViewport,
  motionAllowed,
  useCompactViewport,
} from '@/lib/useCompactViewport';
import {
  buildQuoteVisualPlacement,
  buildQuoteVisualPreviewParams,
  type QuoteVisualFeatures,
} from '@/lib/quoteVisualPlacement';
import type { DoorSpec, WindowSpec } from '@/components/StructurePreview';
import DimensionDivider from '@/components/motif/DimensionDivider';
import SpecTag from '@/components/motif/SpecTag';
import { QuoteActionBar } from '@/components/quote/QuoteActionBar';
import { QuoteActionSheet } from '@/components/quote/QuoteActionSheet';
import { QuoteDeliveryContactStep } from '@/components/quote/QuoteDeliveryContactStep';
import { QuoteMaterialsStep } from '@/components/quote/QuoteMaterialsStep';
import { QuoteMobileNavBar } from '@/components/quote/QuoteMobileNavBar';
import { QuoteNextSteps } from '@/components/quote/QuoteNextSteps';
import {
  QuoteResultPanel,
  type QuotePreviousEstimate,
} from '@/components/quote/QuoteResultPanel';
import { QuoteSectionCard } from '@/components/quote/QuoteSectionCard';
import { QuotePreviewCard } from '@/components/quote/QuotePreviewCard';
import { QuoteSizeStyleStep } from '@/components/quote/QuoteSizeStyleStep';
import { QuoteStepper } from '@/components/quote/QuoteStepper';
import { ghostAction } from '@/components/quote/quoteStyles';
import { QUOTE_RESUME_EVENT } from '@/lib/quoteNavigation';
import { getBuildingQuoteLabel } from '@/lib/buildingCatalog';
import { SMS_QUOTE_CONSENT_REQUIRED_MESSAGE } from '@/lib/smsConsent';

const QUOTE_FORM_ID = 'quote-active-step-form';

const STRUCTURE_TYPE_SELECTOR = '[name="structureType"]';
const PICKER_SELECTED_SELECTOR = '[data-quote-building-picker] [aria-pressed="true"]';
const PICKER_GUIDE_SELECTOR = `${PICKER_SELECTED_SELECTOR}, [data-quote-building-picker] button`;
/** Phones ignore Continue/Back while a push is still settling (no skipped steps). */
const STEP_CHANGE_GUARD_MS = 450;
const HINT_PILL_MS = 2500;
const TEXT_ENTRY_TYPES = new Set(['text', 'email', 'tel', 'number', 'search', 'url']);
const SHAKE_KEYFRAMES: Keyframe[] = [
  { translate: '0 0' },
  { translate: '-8px 0', offset: 0.2 },
  { translate: '7px 0', offset: 0.4 },
  { translate: '-5px 0', offset: 0.6 },
  { translate: '3px 0', offset: 0.8 },
  { translate: '0 0' },
];

type StepDirection = 'none' | 'forward' | 'back';
type QuoteSheet = 'reset' | 'exit' | null;
type HistoryStepHandler = (step: QuoteFlowStep, previousStep: QuoteFlowStep) => void;

/** Phones replace the native structure select with the building picker. */
function resolveGuideSelector(selector: string) {
  return selector === STRUCTURE_TYPE_SELECTOR && isCompactViewport()
    ? PICKER_GUIDE_SELECTOR
    : selector;
}

function queryGuideTarget(root: ParentNode | null | undefined, selector: string) {
  if (!root) return null;
  const resolved = resolveGuideSelector(selector);
  if (resolved !== selector) {
    // A selector list matches in document order; prefer the selected row.
    return (
      root.querySelector<HTMLElement>(PICKER_SELECTED_SELECTOR) ??
      root.querySelector<HTMLElement>(resolved) ??
      root.querySelector<HTMLElement>(selector)
    );
  }
  return root.querySelector<HTMLElement>(selector);
}

function isTextEntry(
  element: EventTarget | null
): element is HTMLInputElement | HTMLTextAreaElement {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && TEXT_ENTRY_TYPES.has(element.type))
  );
}

/** The row or group a guided field lives in (what visibly shakes on phones). */
function findShakeTarget(field: HTMLElement) {
  return (
    field.closest<HTMLElement>('[data-quote-building-picker]') ??
    field.closest<HTMLElement>('[data-qm-row], [class~="phone:qm-row"]') ??
    field.closest<HTMLElement>('[data-qm-group], [class~="phone:qm-group"]') ??
    field.closest<HTMLElement>('label') ??
    field
  );
}

/** "Not yet" shake (Web Animations, so it never fights an element's CSS animation). */
function shake(element: HTMLElement | null) {
  if (!element || !motionAllowed() || typeof element.animate !== 'function') return;
  const rect = element.getBoundingClientRect();
  const inView = rect.top >= 0 && rect.bottom <= window.innerHeight;
  element.animate(SHAKE_KEYFRAMES, {
    duration: 380,
    easing: 'ease-out',
    // Let a guide scroll bring an off-screen target in first.
    delay: inView ? 0 : 320,
  });
}

/** Short config label for the "previous option" comparison, e.g. "10 × 12 ft · Gable". */
function describeEstimate(draft: QuoteDraft, showRoofStyle: boolean) {
  const parts: string[] = [];
  if (!showRoofStyle && draft.structureType) {
    parts.push(getBuildingQuoteLabel(draft.structureType));
  }
  parts.push(`${draft.width} × ${draft.length} ft`);
  const roof = showRoofStyle
    ? roofLabels[draft.roofStyle as keyof typeof roofLabels]
    : undefined;
  if (roof) parts.push(roof);
  return parts.join(' · ');
}

/** View Transition names are set only while a phone push is running. */
function setViewTransitionNames(root: HTMLElement | null, enabled: boolean) {
  root?.querySelectorAll<HTMLElement>('[data-qm-vt-name]').forEach((element) => {
    if (enabled) {
      element.style.setProperty('view-transition-name', element.dataset.qmVtName ?? 'none');
    } else {
      element.style.removeProperty('view-transition-name');
    }
  });
}

export default function QuotePageClient() {
  const historyStepHandlerRef = useRef<HistoryStepHandler>(() => {});
  const handleHistoryStep = useCallback<HistoryStepHandler>(
    (step, previousStep) => historyStepHandlerRef.current(step, previousStep),
    []
  );
  const { state, actions } = useQuoteFlow({ onHistoryStep: handleHistoryStep });
  const isCompact = useCompactViewport();
  const [previewFeatures, setPreviewFeatures] = useState<QuoteVisualFeatures | null>(
    null
  );
  const [actionBarVisible, setActionBarVisible] = useState(true);
  const [showConsentError, setShowConsentError] = useState(false);
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
  const [sheet, setSheet] = useState<QuoteSheet>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [pillHint, setPillHint] = useState<string | null>(null);
  const [motionReady, setMotionReady] = useState(false);
  const [directionOverride, setDirectionOverride] = useState<StepDirection | null>(null);
  const [previousEstimate, setPreviousEstimate] = useState<QuotePreviousEstimate | null>(
    null
  );
  const {
    draft,
    currentStep,
    deliveryZip,
    errors,
    sizePreset,
    submissionError,
    submissionErrorField,
    loading,
    quote,
    showDiscountCode,
    showDeliveryDetails,
    zipLoading,
    locationError,
    viewModel,
    pendingStructureType,
    isHydrated,
  } = state;
  // Phones push/pop screens (steps 0–2, then the result as 3). Restored
  // progress and swipe-backs do not animate ('none').
  const viewIndex = quote ? 3 : currentStep;
  const [stepTransition, setStepTransition] = useState({
    view: viewIndex,
    direction: 'none' as StepDirection,
  });
  if (stepTransition.view !== viewIndex) {
    setStepTransition({
      view: viewIndex,
      direction: !motionReady
        ? 'none'
        : directionOverride ?? (viewIndex > stepTransition.view ? 'forward' : 'back'),
    });
    if (directionOverride !== null) setDirectionOverride(null);
  }
  // Sheets are phone-only; rotating to the desktop layout dismisses them.
  if (!isCompact && sheet !== null) setSheet(null);
  const {
    compareAnotherOption,
    navigateToStep,
    resetFlow,
    startRequestedQuote,
    submitQuote,
  } = actions;
  const sectionRef = useRef<HTMLElement>(null);
  const activeStepRef = useRef<HTMLFormElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const sectionEndRef = useRef<HTMLDivElement>(null);
  const exitLinkRef = useRef<HTMLAnchorElement>(null);
  const pendingStepGuideRef = useRef(false);
  const pendingFieldSelectorRef = useRef<string | null>(null);
  const guideFrameRef = useRef<number | null>(null);
  const previousQuoteRef = useRef(quote);
  const previousSubmissionErrorRef = useRef(submissionError);
  const previousSubmissionErrorFieldRef = useRef(submissionErrorField);
  // Phone-only navigation state.
  const exitConfirmedRef = useRef(false);
  const primaryTapRef = useRef(false);
  const lastStepChangeRef = useRef(Number.NEGATIVE_INFINITY);
  const pendingScrollRef = useRef<number | null>(null);
  const scrollByStepRef = useRef<Partial<Record<QuoteFlowStep, number>>>({});
  const layoutQuoteRef = useRef(quote);
  const viewTransitionRef = useRef<ViewTransition | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const materialsValid = !errors.windowCount && !errors.addOns;
  // Sent with a blocked Get Quote; a fixed category, never the visitor's input.
  const blockingField = getQuoteBlockingField(draft, errors);
  const canContinue =
    currentStep === 0
      ? viewModel.step1Valid
      : currentStep === 1
        ? viewModel.step1Valid && materialsValid
        : viewModel.isValid;

  const actionHint = useMemo(() => {
    if (currentStep === 0) {
      if (!draft.structureType) return 'Select a structure to continue.';
      if (errors.length || errors.width) {
        return 'Check the highlighted dimensions to continue.';
      }
      return 'Your size and style are set. Continue when you are ready.';
    }

    if (!viewModel.step1Valid) {
      return !draft.structureType
        ? 'Review Size & Style and select a structure before continuing.'
        : 'Review the highlighted size field before continuing.';
    }

    if (currentStep === 1) {
      if (errors.windowCount) return 'Enter the number of windows to continue.';
      if (errors.addOns) return 'Check the highlighted upgrade selection.';
      return 'Choose any options you want, then continue.';
    }

    if (errors.length || errors.width) {
      return 'Review the highlighted size field before getting your quote.';
    }
    if (errors.windowCount || errors.addOns) {
      return 'Review the highlighted Materials option before getting your quote.';
    }
    if (!draft.name.trim()) {
      return 'Start with your name to reveal the remaining contact fields.';
    }
    if (!draft.email.trim()) return 'Add your email to continue.';
    if (errors.email) return 'Check your email address.';
    if (!draft.phone.trim()) return 'Add your phone number to continue.';
    if (errors.phone) return 'Check your phone number.';
    if (!draft.smsConsentOptIn) return SMS_QUOTE_CONSENT_REQUIRED_MESSAGE;
    if (errors.deliveryAddress) {
      return showDeliveryDetails
        ? 'Check the highlighted build location.'
        : 'Open Build Location to fix the highlighted field.';
    }
    return 'Everything is ready. Your estimate shows next, and David gets a copy.';
  }, [
    currentStep,
    draft.email,
    draft.name,
    draft.phone,
    draft.smsConsentOptIn,
    draft.structureType,
    errors.addOns,
    errors.deliveryAddress,
    errors.email,
    errors.length,
    errors.phone,
    errors.width,
    errors.windowCount,
    showDeliveryDetails,
    viewModel.step1Valid,
  ]);

  const visualPlacementInputs = useMemo(() => {
    if (!draft.structureType) return null;

    return {
      structureType: draft.structureType,
      length: Number(draft.length) || 0,
      width: Number(draft.width) || 0,
      roofStyle: viewModel.showRoofStyle
        ? (draft.roofStyle as QuoteParams['roofStyle'])
        : undefined,
      wallHeight: Number(draft.wallHeight) as QuoteParams['wallHeight'],
      roofMaterial: viewModel.showRoofMaterial
        ? (draft.roofMaterial as QuoteParams['roofMaterial'])
        : undefined,
      frameGauge: viewModel.showFrameGauge
        ? (draft.frameGauge as QuoteParams['frameGauge'])
        : undefined,
      windowPackage: viewModel.showWindowPackage ? draft.windowPackage || undefined : undefined,
      windowCount:
        viewModel.showWindowPackage && draft.windowPackage
          ? Number(draft.windowCount) || 0
          : undefined,
      ventilation: viewModel.showVentilation ? draft.ventilation : undefined,
      color: draft.color,
      addOns: viewModel.showUpgrades ? draft.addOns : [],
      foundation: draft.foundation as QuoteParams['foundation'],
      door: viewModel.showDoorOptions ? (draft.door as QuoteParams['door']) : undefined,
      siding: undefined,
      deliveryRadius: 0,
    };
  }, [
    draft.addOns,
    draft.color,
    draft.door,
    draft.foundation,
    draft.frameGauge,
    draft.length,
    draft.roofMaterial,
    draft.roofStyle,
    draft.structureType,
    draft.ventilation,
    draft.wallHeight,
    draft.width,
    draft.windowCount,
    draft.windowPackage,
    viewModel.showDoorOptions,
    viewModel.showFrameGauge,
    viewModel.showRoofMaterial,
    viewModel.showRoofStyle,
    viewModel.showUpgrades,
    viewModel.showVentilation,
    viewModel.showWindowPackage,
  ]);

  const previewParams = useMemo(
    () => (visualPlacementInputs ? buildQuoteVisualPreviewParams(visualPlacementInputs) : null),
    [visualPlacementInputs]
  );

  const currentVisualPlacement = useMemo(
    () =>
      visualPlacementInputs
        ? buildQuoteVisualPlacement(visualPlacementInputs, previewFeatures ?? undefined)
        : undefined,
    [previewFeatures, visualPlacementInputs]
  );

  const handlePreviewFeaturesChange = useCallback(
    (next: { doors: DoorSpec[]; windows: WindowSpec[] }) => {
      setPreviewFeatures(next as QuoteVisualFeatures);
    },
    []
  );

  // A failed preview stops reporting, so its last layout would go stale as the
  // customer keeps editing; submit the current defaults instead.
  const handlePreviewError = useCallback(() => setPreviewFeatures(null), []);

  const guideToElement = useCallback(
    (target: HTMLElement | null, block: ScrollLogicalPosition = 'start') => {
      if (!target) return;

      if (guideFrameRef.current !== null) {
        cancelAnimationFrame(guideFrameRef.current);
      }

      guideFrameRef.current = requestAnimationFrame(() => {
        const reduceMotion =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        target.focus({ preventScroll: true });
        target.scrollIntoView?.({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block,
        });
        guideFrameRef.current = null;
      });
    },
    []
  );

  /** Phones: the screen's scroll position is already set; only move focus. */
  const focusWithoutScroll = useCallback((target: HTMLElement | null) => {
    if (!target) return;
    if (guideFrameRef.current !== null) cancelAnimationFrame(guideFrameRef.current);
    guideFrameRef.current = requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      guideFrameRef.current = null;
    });
  }, []);

  const guideToActiveStep = useCallback(() => {
    const heading = activeStepRef.current?.querySelector<HTMLElement>('h2') ?? null;
    guideToElement(heading);
  }, [guideToElement]);

  const getTitleAnchor = useCallback(
    () => (resultRef.current ?? activeStepRef.current)?.querySelector<HTMLElement>('h2') ?? null,
    []
  );

  useEffect(() => {
    trackQuoteStepInClarity(currentStep);
  }, [currentStep]);

  useEffect(() => {
    const resume = () => {
      if (quote) guideToElement(resultRef.current?.querySelector<HTMLElement>('h2') ?? null);
      else guideToActiveStep();
    };
    window.addEventListener(QUOTE_RESUME_EVENT, resume);
    return () => window.removeEventListener(QUOTE_RESUME_EVENT, resume);
  }, [guideToActiveStep, guideToElement, quote]);

  // ---- Phone navigation: push/pop transitions ------------------------------
  // History entries belong to useQuoteFlow's navigateToStep at every width;
  // phones only add the screen transition and per-screen scroll around it.

  const changeStepOnPhone = useCallback(
    (
      step: QuoteFlowStep,
      direction: 'forward' | 'back',
      scrollTop: number | null,
      animate: boolean
    ) => {
      lastStepChangeRef.current = performance.now();
      const root = sectionRef.current;
      // Field-guided jumps scroll to their field afterwards; keep those to the CSS push.
      const canViewTransition =
        animate &&
        scrollTop !== null &&
        motionReady &&
        compactMotionAllowed() &&
        typeof document.startViewTransition === 'function';

      if (!canViewTransition) {
        // CSS push (data-direction), or no animation at all when asked.
        pendingScrollRef.current = scrollTop;
        if (!animate) setDirectionOverride('none');
        navigateToStep(step);
        return;
      }

      // The whole screen pushes as one opaque snapshot of the viewport, captured
      // exactly as the customer left it (never scrolled first, which flashed the
      // old screen's top). The nav bar and floating action bar hold still. The
      // new screen's scroll (top when pushed, where it was left when popped) is
      // set inside the update, before its snapshot.
      const html = document.documentElement;
      html.dataset.qmVt = direction;
      setViewTransitionNames(root, true);
      try {
        const transition = document.startViewTransition(() => {
          pendingScrollRef.current = scrollTop;
          flushSync(() => {
            setDirectionOverride('none');
            navigateToStep(step);
          });
          setViewTransitionNames(root, true);
        });
        viewTransitionRef.current = transition;
        transition.ready.catch(() => {});
        transition.finished
          .catch(() => {})
          .finally(() => {
            if (viewTransitionRef.current !== transition) return;
            viewTransitionRef.current = null;
            delete html.dataset.qmVt;
            setViewTransitionNames(root, false);
          });
      } catch {
        delete html.dataset.qmVt;
        setViewTransitionNames(root, false);
        pendingScrollRef.current = scrollTop;
        navigateToStep(step);
      }
    },
    [motionReady, navigateToStep]
  );

  const goToStep = useCallback(
    (step: QuoteFlowStep, fieldSelector?: string) => {
      if (step === currentStep) {
        if (fieldSelector) {
          guideToElement(queryGuideTarget(activeStepRef.current, fieldSelector), 'center');
        } else {
          guideToActiveStep();
        }
        return;
      }

      pendingFieldSelectorRef.current = fieldSelector ?? null;
      pendingStepGuideRef.current = true;
      setShowConsentError(false);
      if (isCompactViewport()) {
        const forward = step > currentStep;
        if (forward) scrollByStepRef.current[currentStep] = window.scrollY;
        const scrollTop = fieldSelector
          ? null
          : forward
            ? 0
            : (scrollByStepRef.current[step] ?? 0);
        changeStepOnPhone(step, forward ? 'forward' : 'back', scrollTop, true);
      } else {
        navigateToStep(step);
      }
    },
    [
      changeStepOnPhone,
      currentStep,
      guideToActiveStep,
      guideToElement,
      navigateToStep,
    ]
  );

  useEffect(() => {
    // Browser Back/Forward between steps guides focus like the in-app Back.
    historyStepHandlerRef.current = (step, previousStep) => {
      setShowConsentError(false);
      pendingFieldSelectorRef.current = null;
      if (isCompactViewport()) {
        // An edge swipe is already animated by Safari, and Android's Back is
        // instant: change screens without a push, at that screen's own scroll.
        lastStepChangeRef.current = performance.now();
        setDirectionOverride('none');
        if (step < previousStep) {
          pendingScrollRef.current = scrollByStepRef.current[step] ?? 0;
        } else {
          scrollByStepRef.current[previousStep] = window.scrollY;
          pendingScrollRef.current = 0;
        }
      }
      // The same step means only the shown price was cleared; no step change follows.
      if (step !== previousStep) pendingStepGuideRef.current = true;
      else if (isCompactViewport()) {
        focusWithoutScroll(activeStepRef.current?.querySelector<HTMLElement>('h2') ?? null);
      } else guideToActiveStep();
    };
  }, [focusWithoutScroll, guideToActiveStep]);

  useEffect(() => {
    if (!pendingStepGuideRef.current) return;
    pendingStepGuideRef.current = false;
    const fieldSelector = pendingFieldSelectorRef.current;
    pendingFieldSelectorRef.current = null;
    if (fieldSelector) {
      guideToElement(queryGuideTarget(activeStepRef.current, fieldSelector), 'center');
    } else if (isCompactViewport()) {
      focusWithoutScroll(activeStepRef.current?.querySelector<HTMLElement>('h2') ?? null);
    } else {
      guideToActiveStep();
    }
  }, [currentStep, focusWithoutScroll, guideToActiveStep, guideToElement]);

  // Phones: set the new screen's scroll position before it paints.
  useLayoutEffect(() => {
    const revealed = Boolean(quote) && !layoutQuoteRef.current;
    layoutQuoteRef.current = quote;
    const top = revealed && isCompactViewport() ? 0 : pendingScrollRef.current;
    pendingScrollRef.current = null;
    if (top === null) return;
    window.scrollTo({ top, behavior: 'instant' });
  }, [currentStep, quote]);

  // Restored progress never animates: allow push/pop one frame after hydration.
  useEffect(() => {
    if (!isHydrated || !isCompact || motionReady) return;
    const frame = requestAnimationFrame(() => setMotionReady(true));
    return () => cancelAnimationFrame(frame);
  }, [isCompact, isHydrated, motionReady]);

  // Phones: the shell restores each screen's scroll itself (scrollByStepRef), so
  // the browser must not re-apply a wizard entry's saved offset over it after
  // the traversals navigateToStep starts.
  useEffect(() => {
    if (!isCompact || !('scrollRestoration' in window.history)) return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, [isCompact]);

  // Phones: slide the floating bar away while the keyboard is up. Focus says a
  // keyboard is coming; the visual viewport confirms it, so the bar returns when
  // Android hides the keyboard without blurring the field, or none ever opens
  // (hardware keyboard).
  useEffect(() => {
    const root = sectionRef.current;
    if (!isCompact || !root) return;
    const viewport = window.visualViewport;
    let confirmTimer: number | null = null;
    const keyboardShowing = () =>
      !viewport || viewport.height < window.innerHeight * 0.85;
    const clearConfirm = () => {
      if (confirmTimer !== null) window.clearTimeout(confirmTimer);
      confirmTimer = null;
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!isTextEntry(event.target)) return;
      setKeyboardOpen(true);
      clearConfirm();
      confirmTimer = window.setTimeout(() => {
        confirmTimer = null;
        if (!keyboardShowing()) setKeyboardOpen(false);
      }, 700);
    };
    const onFocusOut = (event: FocusEvent) => {
      if (isTextEntry(event.relatedTarget)) return;
      clearConfirm();
      setKeyboardOpen(false);
    };
    const onViewportResize = () => {
      setKeyboardOpen(isTextEntry(document.activeElement) && keyboardShowing());
    };
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    viewport?.addEventListener('resize', onViewportResize);
    return () => {
      clearConfirm();
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      viewport?.removeEventListener('resize', onViewportResize);
      setKeyboardOpen(false);
    };
  }, [isCompact]);

  // A focused field removed with its screen fires no focusout; re-check per screen.
  useEffect(() => {
    if (!isCompact) return;
    setKeyboardOpen(isTextEntry(document.activeElement));
  }, [currentStep, isCompact, quote]);

  useEffect(
    () => () => {
      if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    },
    []
  );

  const showHintPill = useCallback(() => {
    setPillHint(actionHint);
    if (hintTimerRef.current !== null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      hintTimerRef.current = null;
      setPillHint(null);
    }, HINT_PILL_MS);
  }, [actionHint]);

  useEffect(() => {
    if (quote && !previousQuoteRef.current) {
      const heading = resultRef.current?.querySelector<HTMLElement>('h2') ?? null;
      // Phones already scrolled to the top in the layout effect; only move focus.
      if (isCompactViewport()) focusWithoutScroll(heading);
      else guideToElement(heading);
    }
    previousQuoteRef.current = quote;
  }, [focusWithoutScroll, guideToElement, quote]);

  useEffect(() => {
    if (submissionError && submissionError !== previousSubmissionErrorRef.current) {
      guideToElement(document.getElementById('quote-submission-error'), 'center');
    }
    previousSubmissionErrorRef.current = submissionError;
  }, [guideToElement, submissionError]);

  useEffect(() => {
    if (
      submissionErrorField &&
      submissionErrorField !== previousSubmissionErrorFieldRef.current
    ) {
      guideToElement(
        activeStepRef.current?.querySelector<HTMLElement>(
          `[name="${submissionErrorField}"]`
        ) ?? null,
        'center'
      );
    }
    previousSubmissionErrorFieldRef.current = submissionErrorField;
  }, [guideToElement, submissionErrorField]);

  useEffect(
    () => () => {
      if (guideFrameRef.current !== null) {
        cancelAnimationFrame(guideFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const sectionEnd = sectionEndRef.current;
    if (!sectionEnd) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setActionBarVisible(
          entry.isIntersecting || entry.boundingClientRect.bottom > 0
        );
      },
      { threshold: 0 }
    );
    observer.observe(sectionEnd);
    return () => observer.disconnect();
  }, []);

  const submitQuoteWithVisualPlacement = useCallback(() => {
    void submitQuote({ visualPlacement: currentVisualPlacement });
  }, [currentVisualPlacement, submitQuote]);

  const guideToFirstBlockingField = useCallback(
    (emphasize = false) => {
      let selector = STRUCTURE_TYPE_SELECTOR;

      if (currentStep === 0 && draft.structureType) {
        selector = errors.length ? '[name="length"]' : '[name="width"]';
      } else if (currentStep === 1) {
        selector = errors.windowCount ? '[name="windowCount"]' : '#err-addOns';
      } else if (currentStep === 2) {
        if (!draft.name.trim()) selector = '[name="name"]';
        else if (!draft.email.trim() || errors.email) selector = '[name="email"]';
        else if (!draft.phone.trim() || errors.phone) selector = '[name="phone"]';
        else if (!draft.smsConsentOptIn) selector = '[name="smsConsentOptIn"]';
        else selector = '[name="deliveryAddress"]';
      }

      const target = queryGuideTarget(activeStepRef.current, selector);
      const deliveryToggle =
        currentStep === 2 && errors.deliveryAddress
          ? activeStepRef.current?.querySelector<HTMLElement>(
              '#quote-delivery-details-toggle'
            ) ?? null
          : null;
      const destination = target ?? deliveryToggle;

      if (destination && isCompactViewport()) {
        if (emphasize) shake(findShakeTarget(destination));
        if (isTextEntry(destination)) {
          // iOS raises the keyboard only for focus() inside the tap itself.
          if (guideFrameRef.current !== null) {
            cancelAnimationFrame(guideFrameRef.current);
            guideFrameRef.current = null;
          }
          destination.focus();
          return;
        }
      }
      guideToElement(destination, 'center');
    },
    [
      currentStep,
      draft.email,
      draft.name,
      draft.phone,
      draft.smsConsentOptIn,
      draft.structureType,
      errors.deliveryAddress,
      errors.email,
      errors.length,
      errors.phone,
      errors.windowCount,
      guideToElement,
    ]
  );

  const handlePrimaryClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    // detail is 0 for keyboard activation and implicit (Return key) submission.
    primaryTapRef.current = event.detail > 0;
  }, []);

  const handleStepSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const tapped =
        primaryTapRef.current && Boolean((event.nativeEvent as SubmitEvent).submitter);
      primaryTapRef.current = false;
      if (
        compactMotionAllowed() &&
        performance.now() - lastStepChangeRef.current < STEP_CHANGE_GUARD_MS
      ) {
        return;
      }

      if (!canContinue) {
        const emphasize = tapped && isCompactViewport();
        if (emphasize) {
          triggerHaptic('error');
          showHintPill();
        }
        // A blocked Continue is not a failed submission; count only Get Quote.
        if (currentStep === 2) {
          setShowConsentError(true);
          trackWebsiteEvent('form_error', {
            failureCode: 'validation',
            failureField: blockingField,
          });
        }
        if (currentStep > 0 && !viewModel.step1Valid) {
          goToStep(
            0,
            !draft.structureType
              ? STRUCTURE_TYPE_SELECTOR
              : errors.length
                ? '[name="length"]'
                : '[name="width"]'
          );
          return;
        }
        if (currentStep === 2 && (errors.length || errors.width)) {
          goToStep(0, errors.length ? '[name="length"]' : '[name="width"]');
          return;
        }
        if (currentStep === 2 && (errors.windowCount || errors.addOns)) {
          goToStep(
            1,
            errors.windowCount ? '[name="windowCount"]' : '#err-addOns'
          );
          return;
        }
        guideToFirstBlockingField(emphasize);
        return;
      }

      if (tapped && isCompactViewport()) triggerHaptic('impact');

      if (currentStep === 0) {
        goToStep(1);
        return;
      }

      if (currentStep === 1) {
        goToStep(2);
        return;
      }

      submitQuoteWithVisualPlacement();
    },
    [
      blockingField,
      canContinue,
      currentStep,
      draft.structureType,
      errors.addOns,
      errors.length,
      errors.width,
      errors.windowCount,
      goToStep,
      guideToFirstBlockingField,
      showHintPill,
      submitQuoteWithVisualPlacement,
      viewModel.step1Valid,
    ]
  );

  const handleReset = useCallback(() => {
    const shouldWaitForStep = currentStep !== 0;
    const compact = isCompactViewport();
    setPreviousEstimate(null);
    if (compact && shouldWaitForStep) pendingScrollRef.current = 0;
    pendingStepGuideRef.current = shouldWaitForStep;
    resetFlow();
    if (shouldWaitForStep) return;
    if (compact) {
      window.scrollTo({ top: 0, behavior: motionAllowed() ? 'smooth' : 'instant' });
      focusWithoutScroll(activeStepRef.current?.querySelector<HTMLElement>('h2') ?? null);
    } else {
      guideToActiveStep();
    }
  }, [currentStep, focusWithoutScroll, guideToActiveStep, resetFlow]);

  const handleResetClick = useCallback(() => {
    if (isCompactViewport()) {
      setSheet('reset');
      return;
    }
    handleReset();
  }, [handleReset]);

  const handleCompareAnotherOption = useCallback(() => {
    if (quote) {
      setPreviousEstimate({
        total: quote.total,
        summary: describeEstimate(draft, viewModel.showRoofStyle),
      });
    }
    const shouldWaitForStep = currentStep !== 0;
    if (isCompactViewport()) pendingScrollRef.current = 0;
    pendingStepGuideRef.current = shouldWaitForStep;
    compareAnotherOption();
    if (!shouldWaitForStep) guideToActiveStep();
  }, [
    compareAnotherOption,
    currentStep,
    draft,
    guideToActiveStep,
    quote,
    viewModel.showRoofStyle,
  ]);

  const handleStartRequestedQuote = useCallback(() => {
    setPreviousEstimate(null);
    if (isCompactViewport() && currentStep !== 0) pendingScrollRef.current = 0;
    startRequestedQuote();
  }, [currentStep, startRequestedQuote]);

  const handleBack = useCallback(() => {
    if (currentStep === 0) {
      return;
    }
    if (
      compactMotionAllowed() &&
      performance.now() - lastStepChangeRef.current < STEP_CHANGE_GUARD_MS
    ) {
      return;
    }
    // navigateToStep travels back through the wizard's history entries, so the
    // in-app Back and an edge swipe land on the same entry.
    goToStep((currentStep - 1) as QuoteFlowStep);
  }, [currentStep, goToStep]);

  const hasContactDetails = Boolean(
    draft.name.trim() || draft.email.trim() || draft.phone.trim()
  );

  const handleExitClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (exitConfirmedRef.current) {
        exitConfirmedRef.current = false;
        return;
      }
      // Contact details are never saved, so confirm before dropping them.
      if (!hasContactDetails || !isCompactViewport()) return;
      event.preventDefault();
      setSheet('exit');
    },
    [hasContactDetails]
  );

  const confirmExit = useCallback(() => {
    setSheet(null);
    exitConfirmedRef.current = true;
    exitLinkRef.current?.click();
  }, []);

  const closeSheet = useCallback(() => setSheet(null), []);

  const sheetNumber = `SHEET 0${currentStep + 1} / 03`;
  const showLargeTitle = currentStep === 0 && !quote;

  return (
    <section
      ref={sectionRef}
      data-quote-app=""
      data-step={currentStep}
      data-result={quote ? 'true' : 'false'}
      data-direction={stepTransition.direction}
      data-loading={loading ? 'true' : undefined}
      className="interior-page relative isolate min-h-screen p-4 pb-40 pt-8 text-[var(--foreground)] sm:px-6 sm:pt-10 md:pb-32 phone:px-[var(--qm-gutter)] phone:pb-[calc(var(--qm-bar-h)+1rem)] phone:pt-0"
    >
      <QuoteMobileNavBar
        title={quote ? 'Your Quote' : QUOTE_STEP_LABELS[currentStep]}
        subtitle={quote ? undefined : `Step ${currentStep + 1} of 3`}
        progress={quote ? 3 : currentStep + 1}
        showExit={Boolean(quote) || currentStep === 0}
        onExitClick={handleExitClick}
        exitLinkRef={exitLinkRef}
        enabled={isCompact}
        screenKey={viewIndex}
        getTitleAnchor={getTitleAnchor}
      />

      {/* Blueprint backdrop: faint drafting grid fading out below the fold */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] motif-grid [mask-image:linear-gradient(to_bottom,black,transparent)] phone:hidden"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-[10%] top-[-140px] -z-10 h-[280px] rounded-full blur-[120px] phone:hidden"
        style={{ backgroundColor: 'rgb(var(--accent-glow-rgb) / 0.09)' }}
      />

      <header className="mx-auto mb-8 max-w-6xl phone:mb-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <SpecTag as="p" className="phone:hidden">
              Instant Estimate · San Antonio, TX
            </SpecTag>
            <h1
              className={clsx(
                'brand-display mt-4 mb-0 text-3xl text-white sm:text-4xl',
                showLargeTitle ? 'phone:mt-1 phone:qm-large-title' : 'phone:sr-only'
              )}
            >
              Get a Quote
            </h1>
            {showLargeTitle ? (
              <p className="hidden phone:mt-1 phone:block phone:qm-subhead phone:text-[var(--qm-label-2)]">
                Price your build in 3 quick steps.
              </p>
            ) : null}
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55 phone:hidden">
              Choose your size and options, enter your contact details, then view
              your estimated build subtotal. Travel and site costs are confirmed
              separately before a final quote.
            </p>
          </div>
          <p
            aria-hidden="true"
            className="motif-spec hidden text-right text-white/35 sm:block phone:hidden"
          >
            DWG 210-Q
            <span className="mt-1 block text-[var(--accent-light)]">{sheetNumber}</span>
          </p>
        </div>
        <DimensionDivider
          className="mt-6 phone:hidden"
          tone="quiet"
          label="3 Steps · Instant Price"
        />
      </header>

      {pendingStructureType && draft.structureType ? (
        <aside
          aria-label="Building selection"
          className="interior-card mx-auto mb-6 max-w-6xl p-4 sm:p-6 phone:rounded-[var(--qm-radius-group)] phone:bg-[var(--qm-glass-bg)] phone:px-5 phone:pb-4 phone:pt-5 phone:text-center phone:shadow-[var(--qm-glass-edge)] phone:qm-animate-rise"
        >
          <p aria-hidden="true" className="hidden phone:block phone:qm-headline">
            Quote in progress
          </p>
          <p className="text-sm leading-6 text-white/80 phone:mt-1 phone:qm-footnote phone:text-[var(--qm-label-2)]">
            You have a {getBuildingQuoteLabel(draft.structureType)} quote in progress.
            Keep it, or start a new {getBuildingQuoteLabel(pendingStructureType)} quote.
            Starting a new quote clears your current selections and contact details.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 phone:flex-col phone:gap-2">
            <button
              type="button"
              className="btn btn-outline btn-md phone:w-full phone:qm-capsule phone:qm-capsule-glass"
              onClick={actions.keepCurrentQuote}
            >
              Keep current quote
            </button>
            <button
              type="button"
              className="btn btn-primary btn-md phone:w-full phone:qm-capsule phone:bg-transparent phone:font-normal! phone:text-[var(--qm-danger)]"
              disabled={loading}
              onClick={handleStartRequestedQuote}
            >
              Start {getBuildingQuoteLabel(pendingStructureType)} quote
            </button>
          </div>
        </aside>
      ) : null}

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_360px] phone:flex phone:flex-col phone:gap-6">
        <div className="space-y-4">
          <QuoteStepper
            steps={QUOTE_STEP_LABELS}
            currentStep={currentStep}
            canNavigateToStep={(step) =>
              step === currentStep ||
              (!loading &&
                (step === 0 ||
                  (viewModel.step1Valid && (step < 2 || materialsValid))))
            }
            onStepSelect={(step) => goToStep(step as QuoteFlowStep)}
          />

          <form
            id={QUOTE_FORM_ID}
            key={currentStep}
            ref={activeStepRef}
            noValidate
            onSubmit={handleStepSubmit}
            className={clsx(
              'quote-step-enter scroll-mt-24 sm:scroll-mt-28',
              'phone:scroll-mt-[calc(env(safe-area-inset-top,0px)+5.5rem)] phone:transition-opacity phone:duration-200 phone:in-data-[loading=true]:pointer-events-none phone:in-data-[loading=true]:opacity-55',
              quote && 'phone:hidden'
            )}
          >
            {currentStep === 0 ? (
              <QuoteSizeStyleStep
                draft={draft}
                errors={errors}
                area={viewModel.area}
                maxLength={viewModel.maxLength}
                maxWidth={viewModel.maxWidth}
                sizePreset={sizePreset}
                showWallHeight={viewModel.showWallHeight}
                showRoofStyle={viewModel.showRoofStyle}
                showRoofMaterial={viewModel.showRoofMaterial}
                onInputChange={actions.handleChange}
                onStructureTypeChange={actions.selectStructureType}
                onSizePresetChange={actions.selectSizePreset}
                onWallHeightChange={actions.setWallHeight}
                onRoofStyleChange={actions.setRoofStyle}
                onRoofMaterialChange={actions.setRoofMaterial}
              />
            ) : null}

            {currentStep === 1 ? (
              <QuoteMaterialsStep
                draft={draft}
                errors={errors}
                showDoorOptions={viewModel.showDoorOptions}
                showPanelMaterial={viewModel.showPanelMaterial}
                showFrameGauge={viewModel.showFrameGauge}
                showWindowPackage={viewModel.showWindowPackage}
                showVentilation={viewModel.showVentilation}
                showColor={viewModel.showColor}
                showUpgrades={viewModel.showUpgrades}
                onInputChange={actions.handleChange}
                onToggleAddOn={actions.toggleAddOn}
                onColorChange={actions.setColor}
              />
            ) : null}

            {currentStep === 2 ? (
              <QuoteDeliveryContactStep
                draft={draft}
                errors={errors}
                deliveryZip={deliveryZip}
                showConsentError={showConsentError}
                showDeliveryDetails={showDeliveryDetails}
                showDiscountCode={showDiscountCode}
                zipLoading={zipLoading}
                locationError={locationError}
                submissionError={submissionError}
                onInputChange={actions.handleChange}
                onDeliveryZipChange={actions.setDeliveryZip}
                onToggleDeliveryDetails={actions.toggleDeliveryDetails}
                onRequestCurrentLocation={actions.requestCurrentLocation}
                onShowDiscountCode={actions.showDiscountCode}
              />
            ) : null}
          </form>

          {actionBarVisible && !quote ? (
            <QuoteActionBar
              currentStep={currentStep}
              currentStepLabel={QUOTE_STEP_LABELS[currentStep]}
              formId={QUOTE_FORM_ID}
              hint={actionHint}
              loading={loading}
              canContinue={canContinue}
              onBack={handleBack}
              hintVisible={pillHint !== null && pillHint === actionHint}
              keyboardOpen={keyboardOpen}
              ready={motionReady}
              onPrimaryClick={handlePrimaryClick}
            />
          ) : null}

          {quote ? (
            <div ref={resultRef} className="quote-step-enter scroll-mt-24 sm:scroll-mt-28">
              <p className="sr-only" role="status">
                Your quote is ready.
              </p>
              <QuoteResultPanel
                quote={quote}
                wallHeight={Number(draft.wallHeight) as 6 | 7 | 8}
                attemptedDiscountCode={draft.discountCode}
                previousEstimate={previousEstimate}
                foundation={draft.foundation}
              />
              <QuoteNextSteps
                quote={quote}
                onCompareAnotherOption={handleCompareAnotherOption}
              />
            </div>
          ) : null}
        </div>

        <aside className="space-y-4 md:sticky md:top-24 md:self-start phone:contents phone:space-y-0">
          <QuotePreviewCard
            draft={draft}
            previewParams={previewParams}
            onChangeFeatures={handlePreviewFeaturesChange}
            deliveryZip={deliveryZip}
            quote={quote}
            showWallHeight={viewModel.showWallHeight}
            sheetNumber={sheetNumber}
            onPreviewError={handlePreviewError}
            className="phone:order-first"
          />

          <QuoteSectionCard
            className={`phone:order-last phone:qm-group ${
              // Phones: nothing to clear on a pristine first screen.
              !draft.structureType && !quote ? 'phone:hidden' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="brand-subheading text-sm phone:hidden">Need to start over?</p>
              <button
                type="button"
                onClick={handleResetClick}
                className={`${ghostAction} px-3 py-1.5 phone:qm-row phone:justify-center phone:text-[var(--qm-danger)]!`}
              >
                Reset form
              </button>
            </div>
          </QuoteSectionCard>
        </aside>
      </div>
      <div ref={sectionEndRef} aria-hidden="true" className="h-px" />
      <div ref={setOverlayContainer} data-quote-overlays="" className="contents" />

      {sheet === 'reset' ? (
        <QuoteActionSheet
          container={overlayContainer}
          title="Start over?"
          message="Your selections and contact details will be cleared."
          actions={[
            {
              label: 'Clear All Selections',
              destructive: true,
              onSelect: () => {
                setSheet(null);
                handleReset();
              },
            },
          ]}
          onCancel={closeSheet}
        />
      ) : null}
      {sheet === 'exit' ? (
        <QuoteActionSheet
          container={overlayContainer}
          title="Discard this quote?"
          message="Your contact details are not saved if you leave now."
          actions={[{ label: 'Discard Quote', destructive: true, onSelect: confirmExit }]}
          cancelLabel="Keep Editing"
          onCancel={closeSheet}
        />
      ) : null}
    </section>
  );
}
