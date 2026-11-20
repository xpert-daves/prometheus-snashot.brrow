'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  submitQuoteRequest,
  type QuoteSubmissionResult,
  type SubmitQuoteRequestOptions,
} from '@/lib/quoteSubmission';
import type { QuoteSubmissionState } from '@/lib/quoteFlow';
import {
  getTurnstileSiteKey,
  QUOTE_TURNSTILE_ACTION,
  QUOTE_TURNSTILE_TIMEOUT_MS,
  runTurnstileOverPage,
} from '@/lib/turnstile';

export function useQuoteSubmission() {
  const [submission, setSubmission] = useState<QuoteSubmissionState>({
    status: 'idle',
  });
  const activeControllerRef = useRef<AbortController | null>(null);
  const activeRequestIdRef = useRef(0);

  const resetSubmission = useCallback(() => {
    activeControllerRef.current?.abort();
    activeControllerRef.current = null;
    activeRequestIdRef.current += 1;
    setSubmission({ status: 'idle' });
  }, []);

  const submit = useCallback(async (options: SubmitQuoteRequestOptions) => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    setSubmission({ status: 'submitting' });

    // The invisible bot check, while the button already shows "submitting".
    // '' (a blocked script, a timeout) still submits: the server takes an
    // unchecked quote within tighter limits. With no site key there is no
    // check and no wait.
    let turnstileToken = '';
    if (getTurnstileSiteKey()) {
      turnstileToken = await runTurnstileOverPage({
        action: QUOTE_TURNSTILE_ACTION,
        timeoutMs: QUOTE_TURNSTILE_TIMEOUT_MS,
      });
      // Superseded or reset while the check ran: nothing was sent.
      if (requestId !== activeRequestIdRef.current) {
        return { kind: 'aborted' } satisfies QuoteSubmissionResult;
      }
    }

    const result = await submitQuoteRequest(
      { ...options, turnstileToken },
      { signal: controller.signal }
    );

    if (requestId !== activeRequestIdRef.current) {
      return { kind: 'aborted' } satisfies QuoteSubmissionResult;
    }

    if (result.kind === 'success') {
      setSubmission({ status: 'success', quote: result.quote });
      return result;
    }

    if (result.kind === 'response_error') {
      setSubmission({ status: 'error', error: result.error, field: result.field });
      return result;
    }

    if (result.kind === 'network_error') {
      setSubmission({ status: 'error', error: result.error });
      return result;
    }

    setSubmission({ status: 'idle' });
    return result;
  }, []);

  useEffect(() => {
    return () => {
      activeControllerRef.current?.abort();
    };
  }, []);

  return {
    submission,
    submit,
    resetSubmission,
  };
}
