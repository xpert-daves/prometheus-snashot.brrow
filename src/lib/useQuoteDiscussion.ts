'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type DiscussionState =
  | { status: 'idle' | 'sending' }
  | { status: 'saved'; requestId: string }
  | { status: 'error'; message: string; expired: boolean };

const requestError = 'We could not let David know you are ready to schedule. Please try again.';
const rateLimitError = 'Please wait a moment before trying again.';
const expiredError = 'This estimate’s scheduling link has expired. Use Compare another option to get a fresh estimate, then tap Ready to schedule.';

export function useQuoteDiscussion(quoteId: string, actionToken: string) {
  const [storedState, setStoredState] = useState<DiscussionState & { quoteId: string }>({
    quoteId,
    status: 'idle',
  });
  const activeRequest = useRef<AbortController | null>(null);
  const savedQuoteId = useRef<string | null>(null);

  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, [quoteId, actionToken]);

  const requestDiscussion = useCallback(async () => {
    if (!actionToken || activeRequest.current || savedQuoteId.current === quoteId) return;

    const controller = new AbortController();
    activeRequest.current = controller;
    setStoredState({ quoteId, status: 'sending' });

    try {
      const response = await fetch('/api/quote/discussion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId, actionToken }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(response.status === 410
          ? expiredError
          : response.status === 429 ? rateLimitError : requestError);
      }
      const receipt: unknown = await response.json();
      if (
        !receipt || typeof receipt !== 'object' ||
        !('ok' in receipt) || receipt.ok !== true ||
        !('requestId' in receipt) || typeof receipt.requestId !== 'string' || !receipt.requestId.trim() ||
        !('status' in receipt) || !['created', 'deduped'].includes(String(receipt.status))
      ) {
        throw new Error(requestError);
      }
      if (activeRequest.current !== controller) return;
      savedQuoteId.current = quoteId;
      setStoredState({ quoteId, status: 'saved', requestId: receipt.requestId });
    } catch (error) {
      if (activeRequest.current !== controller || controller.signal.aborted) return;
      setStoredState({
        quoteId,
        status: 'error',
        expired: error instanceof Error && error.message === expiredError,
        message: error instanceof Error && [expiredError, rateLimitError].includes(error.message)
          ? error.message
          : requestError,
      });
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }, [quoteId, actionToken]);

  const state: DiscussionState = storedState.quoteId === quoteId
    ? storedState
    : { status: 'idle' };

  return { state, requestDiscussion };
}
