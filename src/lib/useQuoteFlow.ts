'use client';

import type { ChangeEvent, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { trackEvent } from '@/lib/analytics';
import {
  trackWebsiteEvent,
  trackSavedQuoteInClarity,
  type WebsiteFailureCode,
} from '@/lib/websiteMeasurement';
import { formatUSForDisplay } from '@/lib/phone';
import { initialQuoteFormParams } from '@/lib/quoteForm';
import {
  createInitialQuoteFlowState,
  deriveSizePreset,
  getQuoteBlockingField,
  getQuoteErrors,
  getQuoteViewModel,
  isRampAddOn,
  quoteFlowReducer,
  setRampAddOn,
  SIZE_PRESETS,
  syncRampAddOnForDoor,
  type QuoteDraft,
  type QuoteFlowStep,
  type QuotePresetKey,
  type QuoteSubmissionState,
} from '@/lib/quoteFlow';
import { useQuoteDeliveryPrefill } from '@/lib/useQuoteDeliveryPrefill';
import { useQuoteFormPersistence } from '@/lib/useQuoteFormPersistence';
import { useQuoteSubmission } from '@/lib/useQuoteSubmission';
import { loadTurnstile } from '@/lib/turnstile';
import type { QuoteSubmissionResult } from '@/lib/quoteSubmission';
import type { QuoteVisualPlacement } from '@/lib/quoteVisualPlacement';
import type { PublicBuildingType } from '@/lib/buildingCatalog';
import {
  clearRequestedQuoteStructureType,
  getRequestedQuoteStructureType,
} from '@/lib/quoteNavigation';

function getSubmissionFailureCode(
  result: Extract<QuoteSubmissionResult, { kind: 'response_error' | 'network_error' }>
): WebsiteFailureCode {
  if (result.kind === 'network_error') return 'network';
  // 4xx means the request was refused as sent; a 429 limit is temporary.
  return result.status >= 400 && result.status < 500 && result.status !== 429
    ? 'rejected'
    : 'unavailable';
}

// Wizard steps are browser history entries so a phone Back gesture moves
// between steps instead of leaving /quote, where a remount would drop the
// contact details and consent that are deliberately kept out of storage.
// Each entry records the steps of the wizard entries beneath it, oldest first.
const STEP_HISTORY_KEY = 'shed210QuoteSteps';

function readStepTrail(historyState: unknown): QuoteFlowStep[] | null {
  const trail = (historyState as Record<string, unknown> | null)?.[STEP_HISTORY_KEY];
  return Array.isArray(trail) &&
    trail.length > 0 &&
    trail.every((step) => step === 0 || step === 1 || step === 2)
    ? (trail as QuoteFlowStep[])
    : null;
}

// Next reloads the page when it pops an entry without its __NA marker, and its
// patched history methods copy that state only from the current entry, which a
// fragment link such as "Skip to content" leaves empty. So wizard entries carry
// the router state Next last stamped on /quote.
let nextRouterHistoryState: Record<string, unknown> = {};

function rememberNextRouterHistoryState(historyState: unknown) {
  const state = historyState as Record<string, unknown> | null;
  if (!state?.__NA) return;
  nextRouterHistoryState = {
    __NA: state.__NA,
    __PRIVATE_NEXTJS_INTERNALS_TREE: state.__PRIVATE_NEXTJS_INTERNALS_TREE,
  };
}

// Never pass a URL. Next's patched history methods store a URL-less entry and
// dispatch nothing; with a URL they start a router action.
function pushStepTrail(trail: QuoteFlowStep[]) {
  rememberNextRouterHistoryState(window.history.state);
  window.history.pushState({ ...nextRouterHistoryState, [STEP_HISTORY_KEY]: trail }, '');
}

function replaceStepTrail(trail: QuoteFlowStep[]) {
  rememberNextRouterHistoryState(window.history.state);
  window.history.replaceState(
    { ...nextRouterHistoryState, ...(window.history.state ?? {}), [STEP_HISTORY_KEY]: trail },
    ''
  );
}

/** The current entry's trail when it matches the step on screen. */
function readSyncedStepTrail(currentStep: QuoteFlowStep) {
  const trail = readStepTrail(window.history.state);
  return trail && trail[trail.length - 1] === currentStep ? trail : null;
}

function blocksLocationPrefill(status: QuoteSubmissionState['status']) {
  return status === 'submitting' || status === 'success';
}

function applyDraftUpdate(
  current: QuoteDraft,
  next: SetStateAction<QuoteDraft>
): QuoteDraft {
  return typeof next === 'function'
    ? (next as (value: QuoteDraft) => QuoteDraft)(current)
    : next;
}

type UseQuoteFlowOptions = {
  /** Runs before a browser Back/Forward changes the step or clears the result. */
  onHistoryStep?: (step: QuoteFlowStep, previousStep: QuoteFlowStep) => void;
};

export function useQuoteFlow({ onHistoryStep }: UseQuoteFlowOptions = {}) {
  const [state, dispatch] = useReducer(
    quoteFlowReducer,
    undefined,
    createInitialQuoteFlowState
  );
  const stateRef = useRef(state);
  const prevStepRef = useRef<QuoteFlowStep | -1>(-1);
  const requestedTypeHandledRef = useRef(false);
  const onHistoryStepRef = useRef(onHistoryStep);
  const relabelOnPopRef = useRef<QuoteFlowStep | null>(null);
  const [pendingStructureType, setPendingStructureType] = useState<PublicBuildingType | null>(null);
  const { submission, submit, resetSubmission } = useQuoteSubmission();

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Fetch the bot check's script on the last step, so submit doesn't wait on it.
  const onLastStep = state.currentStep === 2;
  useEffect(() => {
    if (onLastStep) void loadTurnstile();
  }, [onLastStep]);

  useEffect(() => {
    onHistoryStepRef.current = onHistoryStep;
  }, [onHistoryStep]);

  useEffect(() => {
    dispatch({ type: 'set_submission', submission });
  }, [submission]);

  const setDraftState = useCallback(
    (
      next: SetStateAction<QuoteDraft>,
      options?: { sizePreset?: QuotePresetKey; keepSubmission?: boolean }
    ) => {
      const current = stateRef.current.draft;
      const nextDraft = applyDraftUpdate(current, next);
      if (nextDraft === current) return;

      if (!options?.keepSubmission && stateRef.current.submission.status !== 'idle') {
        resetSubmission();
      }

      dispatch({ type: 'replace_draft', draft: nextDraft });
      dispatch({
        type: 'set_size_preset',
        sizePreset: options?.sizePreset ?? deriveSizePreset(nextDraft),
      });

      if (nextDraft.discountCode.trim()) {
        dispatch({ type: 'set_show_discount_code', showDiscountCode: true });
      }
    },
    [resetSubmission]
  );

  const setCurrentStepState = useCallback(
    (next: SetStateAction<number>) => {
      const current = stateRef.current.currentStep;
      const resolved = typeof next === 'function' ? next(current) : next;
      const bounded = Math.max(0, Math.min(2, resolved)) as QuoteFlowStep;
      dispatch({ type: 'set_step', step: bounded });
    },
    []
  );

  const { sessionIdRef, resetQuoteFormPersistence, isHydrated } = useQuoteFormPersistence({
    params: state.draft,
    setParams: setDraftState,
    currentStep: state.currentStep,
    setCurrentStep: setCurrentStepState,
    maxStep: 2,
    onOpen: () => trackEvent('quote_form_opened'),
  });

  const setDeliveryZip = useCallback((deliveryZip: string) => {
    if (deliveryZip !== stateRef.current.deliveryZip && stateRef.current.submission.status !== 'idle') {
      resetSubmission();
    }
    dispatch({ type: 'set_delivery_zip', deliveryZip });
  }, [resetSubmission]);

  // A location lookup can resolve long after the customer moved on. Unlike a
  // manual edit, it must not abort an in-flight request or clear a shown price.
  // After a failed submit it still fills the location for the retry, and leaves
  // the error on screen.
  const setPrefilledDeliveryZip = useCallback((deliveryZip: string) => {
    if (blocksLocationPrefill(stateRef.current.submission.status)) return;
    dispatch({ type: 'set_delivery_zip', deliveryZip });
  }, []);

  const setPrefilledDraft = useCallback(
    (next: SetStateAction<QuoteDraft>) => {
      if (blocksLocationPrefill(stateRef.current.submission.status)) return;
      setDraftState(next, { keepSubmission: true });
    },
    [setDraftState]
  );

  const {
    showDeliveryDetails,
    toggleDeliveryDetails,
    requestCurrentLocation,
    zipLoading,
    locationError,
  } = useQuoteDeliveryPrefill({
    setDeliveryZip: setPrefilledDeliveryZip,
    setParams: setPrefilledDraft,
  });

  const submissionErrorField =
    state.submission.status === 'error' ? state.submission.field ?? null : null;
  const submissionFieldMessage =
    state.submission.status === 'error' ? state.submission.error : null;
  const errors = useMemo(() => {
    const draftErrors = getQuoteErrors(state.draft);
    // Mark a field the server rejected until the customer edits the form,
    // which resets the submission.
    if (!submissionErrorField || draftErrors[submissionErrorField]) return draftErrors;
    return { ...draftErrors, [submissionErrorField]: submissionFieldMessage ?? '' };
  }, [state.draft, submissionErrorField, submissionFieldMessage]);
  const viewModel = useMemo(
    () => getQuoteViewModel(state.draft, errors),
    [errors, state.draft]
  );

  useEffect(() => {
    const { maxLength, maxWidth } = getQuoteViewModel(
      stateRef.current.draft,
      getQuoteErrors(stateRef.current.draft)
    );
    const lengthNum = Number(stateRef.current.draft.length);
    const widthNum = Number(stateRef.current.draft.width);

    if (lengthNum > maxLength) {
      setDraftState(
        (prev) => ({ ...prev, length: String(maxLength) }),
        { sizePreset: 'custom' }
      );
      return;
    }

    if (widthNum > maxWidth) {
      setDraftState(
        (prev) => ({ ...prev, width: String(maxWidth) }),
        { sizePreset: 'custom' }
      );
    }
  }, [setDraftState, state.draft.length, state.draft.width, state.draft.structureType]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;
    if (prevStepRef.current !== state.currentStep) {
      trackEvent('quote_step_viewed', { step: state.currentStep });
      prevStepRef.current = state.currentStep;
    }
  }, [state.currentStep]);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type, checked } = event.target as HTMLInputElement;
      if (type === 'checkbox') {
        setDraftState((prev) => ({ ...prev, [name]: checked }) as QuoteDraft);
        return;
      }

      if (name === 'phone') {
        setDraftState((prev) => ({
          ...prev,
          phone: formatUSForDisplay(value),
        }));
        return;
      }

      if (name === 'door') {
        setDraftState((prev) => ({
          ...prev,
          door: value,
          addOns: syncRampAddOnForDoor(prev.addOns, value),
        }));
        return;
      }

      const sizePreset = name === 'length' || name === 'width' ? 'custom' : undefined;
      setDraftState(
        (prev) => ({ ...prev, [name]: value }) as QuoteDraft,
        sizePreset ? { sizePreset } : undefined
      );
    },
    [setDraftState]
  );

  const setCurrentStep = useCallback((step: QuoteFlowStep) => {
    dispatch({ type: 'set_step', step });
  }, []);

  /**
   * Moves the wizard the way a customer does: forward moves push an entry per
   * step, backward moves travel back through those entries. The step applies
   * immediately; the popstate that follows finds it already on screen.
   */
  const navigateToStep = useCallback(
    (step: QuoteFlowStep) => {
      const current = stateRef.current.currentStep;
      if (step === current) return;
      const trail = readSyncedStepTrail(current);

      if (step > current) {
        // A pushed entry keeps the current URL, so drop ?structureType first.
        clearRequestedQuoteStructureType();
        let entries = trail ?? [current];
        if (!trail) replaceStepTrail(entries);
        for (let next = current + 1; next <= step; next += 1) {
          entries = [...entries, next as QuoteFlowStep];
          pushStepTrail(entries);
        }
      } else {
        // Leaving a shown quote clears the price, like Compare another option.
        if (stateRef.current.submission.status === 'success') resetSubmission();
        const lastIndex = (trail?.length ?? 1) - 1;
        const target = trail && lastIndex > 0 ? trail.lastIndexOf(step, lastIndex - 1) : -1;
        if (trail && target >= 0) {
          window.history.go(target - lastIndex);
        } else if (trail && lastIndex > 0) {
          // The step is below the oldest wizard entry: return to it and relabel it.
          relabelOnPopRef.current = step;
          window.history.go(-lastIndex);
        } else {
          replaceStepTrail([step]);
        }
      }

      dispatch({ type: 'set_step', step });
    },
    [resetSubmission]
  );

  useEffect(() => {
    const quotePath = window.location.pathname;
    // Next stamps its router state in an insertion effect, before this runs.
    rememberNextRouterHistoryState(window.history.state);
    const handlePopState = (event: PopStateEvent) => {
      // Next handles traversals that leave /quote.
      if (window.location.pathname !== quotePath) return;
      rememberNextRouterHistoryState(event.state);

      const relabel = relabelOnPopRef.current;
      relabelOnPopRef.current = null;
      if (relabel !== null) {
        replaceStepTrail([relabel]);
        return;
      }

      // Entries the wizard did not create (an in-page anchor, say) are ignored.
      const trail = readStepTrail(event.state);
      if (!trail) return;
      const previousStep = stateRef.current.currentStep;
      // While a quote is saving, stay on the contact step so the price lands
      // under the details the customer sent. The in-app Back is disabled then too.
      if (stateRef.current.submission.status === 'submitting') {
        if (trail[trail.length - 1] !== previousStep) pushStepTrail([...trail, previousStep]);
        return;
      }
      const step = trail[trail.length - 1];
      const clearsResult = stateRef.current.submission.status === 'success';
      if (step === previousStep && !clearsResult) return;

      onHistoryStepRef.current?.(step, previousStep);
      if (clearsResult) resetSubmission();
      dispatch({ type: 'set_step', step });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [resetSubmission]);

  const selectStructureType = useCallback(
    (structureType: QuoteDraft['structureType']) => {
      const noDoor = ['carport', 'open_loafing'].includes(structureType);
      const noUpgrades = ['carport', 'well_pump', 'open_loafing'].includes(
        structureType
      );

      setDraftState(
        (prev) => {
          const nextDoor = noDoor ? 'single_shed' : prev.door;
          return {
            ...prev,
            structureType,
            wallHeight: initialQuoteFormParams.wallHeight,
            door: nextDoor,
            addOns: noUpgrades ? [] : syncRampAddOnForDoor(prev.addOns, nextDoor),
            length: '10',
            width: '8',
          } as QuoteDraft;
        },
        { sizePreset: '8x10' }
      );
    },
    [setDraftState]
  );

  useEffect(() => {
    if (!isHydrated || requestedTypeHandledRef.current) return;
    requestedTypeHandledRef.current = true;
    const requested = getRequestedQuoteStructureType(window.location.search);
    if (!requested) return;

    const currentType = stateRef.current.draft.structureType;
    if (!currentType) {
      selectStructureType(requested);
      setCurrentStep(0);
      clearRequestedQuoteStructureType();
    } else if (currentType !== requested) {
      setPendingStructureType(requested);
    } else {
      clearRequestedQuoteStructureType();
    }
  }, [isHydrated, selectStructureType, setCurrentStep]);

  const selectSizePreset = useCallback(
    (sizePreset: QuotePresetKey) => {
      if (sizePreset === 'custom') {
        dispatch({ type: 'set_size_preset', sizePreset: 'custom' });
        return;
      }

      const preset = SIZE_PRESETS.find((option) => option.key === sizePreset);
      if (!preset) return;

      setDraftState(
        (prev) => ({
          ...prev,
          length: preset.length,
          width: preset.width,
        }),
        { sizePreset }
      );
    },
    [setDraftState]
  );

  const setWallHeight = useCallback(
    (wallHeight: QuoteDraft['wallHeight']) => {
      setDraftState((prev) => ({ ...prev, wallHeight }));
    },
    [setDraftState]
  );

  const setRoofStyle = useCallback(
    (roofStyle: QuoteDraft['roofStyle']) => {
      setDraftState((prev) => ({ ...prev, roofStyle }));
    },
    [setDraftState]
  );

  const setRoofMaterial = useCallback(
    (roofMaterial: QuoteDraft['roofMaterial']) => {
      setDraftState((prev) => ({ ...prev, roofMaterial }));
    },
    [setDraftState]
  );

  const setColor = useCallback(
    (color: string) => {
      setDraftState((prev) => ({ ...prev, color }));
    },
    [setDraftState]
  );

  const toggleAddOn = useCallback(
    (option: string, checked: boolean) => {
      setDraftState((prev) => {
        if (isRampAddOn(option)) {
          return {
            ...prev,
            addOns: setRampAddOn(prev.addOns, option, checked),
          };
        }

        const addOns = new Set(prev.addOns);
        if (checked) addOns.add(option);
        else addOns.delete(option);
        return {
          ...prev,
          addOns: Array.from(addOns),
        };
      });
    },
    [setDraftState]
  );

  const showDiscountCode = useCallback(() => {
    dispatch({ type: 'set_show_discount_code', showDiscountCode: true });
  }, []);

  const submitQuote = useCallback(async (options?: { visualPlacement?: QuoteVisualPlacement }) => {
    const currentDraft = stateRef.current.draft;
    const currentErrors = getQuoteErrors(currentDraft);

    if (Object.keys(currentErrors).length > 0) {
      trackWebsiteEvent('form_error', {
        failureCode: 'validation',
        failureField: getQuoteBlockingField(currentDraft, currentErrors),
      });
      return;
    }

    trackEvent('quote_form_submitted', {
      structureType: currentDraft.structureType,
      length: Number(currentDraft.length),
      width: Number(currentDraft.width),
      roofStyle: currentDraft.roofStyle,
      roofMaterial: currentDraft.roofMaterial,
      foundation: currentDraft.foundation,
      door: currentDraft.door,
    });

    const result = await submit({
      params: currentDraft,
      deliveryZip: stateRef.current.deliveryZip,
      sessionId: sessionIdRef.current,
      visualPlacement: options?.visualPlacement,
    });

    if (result.kind === 'success') {
      // The result has no history entry of its own: Back leaves the step and
      // clears the price, like any backward move from a shown quote.
      trackSavedQuoteInClarity(result.quote.id);
      trackEvent('quote_success', {
        quoteId: result.quote.id,
        total: result.quote.total,
      });
      trackEvent('quote_generated', {
        quoteId: result.quote.id,
        total: result.quote.total,
      });
      trackEvent('quote_next_steps_viewed', {
        quoteId: result.quote.id,
      });
    } else if (result.kind !== 'aborted') {
      trackWebsiteEvent('form_error', {
        failureCode: getSubmissionFailureCode(result),
      });
    }
  }, [sessionIdRef, submit]);

  const resetFlow = useCallback(() => {
    navigateToStep(0);
    resetSubmission();
    dispatch({ type: 'reset' });
    resetQuoteFormPersistence();
    setPendingStructureType(null);
    clearRequestedQuoteStructureType();
  }, [navigateToStep, resetQuoteFormPersistence, resetSubmission]);

  const keepCurrentQuote = useCallback(() => {
    setPendingStructureType(null);
    clearRequestedQuoteStructureType();
  }, []);

  const startRequestedQuote = useCallback(() => {
    if (!pendingStructureType) return;
    resetFlow();
    setDraftState({ ...initialQuoteFormParams, structureType: pendingStructureType });
  }, [pendingStructureType, resetFlow, setDraftState]);

  const trackTextClick = useCallback(() => {
    const quoteId =
      stateRef.current.submission.status === 'success'
        ? stateRef.current.submission.quote.id
        : null;
    trackEvent('text_click', { location: 'quote_next_steps', quoteId: quoteId ?? '' });
    trackEvent('quote_contact_text_clicked', { quoteId: quoteId ?? '' });
  }, []);

  const trackContactPageClick = useCallback(() => {
    const quoteId =
      stateRef.current.submission.status === 'success'
        ? stateRef.current.submission.quote.id
        : null;
    trackEvent('contact_cta_clicked', { location: 'quote_next_steps', quoteId: quoteId ?? '' });
    trackEvent('quote_contact_page_clicked', { quoteId: quoteId ?? '' });
  }, []);

  const compareAnotherOption = useCallback(() => {
    const quoteId =
      stateRef.current.submission.status === 'success'
        ? stateRef.current.submission.quote.id
        : null;
    trackEvent('quote_compare_another_clicked', { quoteId: quoteId ?? '' });
    navigateToStep(0);
    resetSubmission();
    dispatch({ type: 'compare_another_option' });
  }, [navigateToStep, resetSubmission]);

  return {
    state: {
      ...state,
      /** Saved draft/step restored from storage (phones only animate step changes after this). */
      isHydrated,
      pendingStructureType,
      errors,
      viewModel,
      showDeliveryDetails,
      zipLoading,
      locationError,
      loading: state.submission.status === 'submitting',
      submissionError:
        state.submission.status === 'error' && !submissionErrorField
          ? state.submission.error
          : null,
      submissionErrorField,
      quote:
        state.submission.status === 'success' ? state.submission.quote : null,
    },
    actions: {
      handleChange,
      setCurrentStep,
      navigateToStep,
      selectStructureType,
      selectSizePreset,
      setWallHeight,
      setRoofStyle,
      setRoofMaterial,
      setColor,
      setDeliveryZip,
      toggleAddOn,
      toggleDeliveryDetails,
      requestCurrentLocation,
      showDiscountCode,
      submitQuote,
      resetFlow,
      keepCurrentQuote,
      startRequestedQuote,
      trackTextClick,
      trackContactPageClick,
      compareAnotherOption,
    },
  };
}
