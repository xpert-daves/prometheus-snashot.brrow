import { useCallback, useEffect, useRef, useState } from 'react';
import { stripPII } from '@/lib/pii';
import { currentBrandColorHex, type QuoteFormParams } from '@/lib/quoteForm';
import {
  readLocalStorage,
  readSessionStorage,
  removeLocalStorage,
  removeSessionStorage,
  writeLocalStorage,
  writeSessionStorage,
} from '@/lib/safeStorage';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type UseQuoteFormPersistenceOptions = {
  params: QuoteFormParams;
  setParams: SetState<QuoteFormParams>;
  currentStep: number;
  setCurrentStep: SetState<number>;
  maxStep: number;
  onOpen?: () => void;
};

const QUOTE_PARAMS_KEY = 'quote-params';
const QUOTE_STEP_KEY = 'quote-step';
const QUOTE_SESSION_KEY = 'quote-session-id';

// The draft and step survive in localStorage, so a visitor who looks at
// buildings mid-quote comes back to the contact step. Name, email and phone are
// kept for the tab only, in sessionStorage, so that visitor finds them filled
// in while the next person on a shared device does not. Consent is never saved:
// it is ticked on the visit that sends it. The build address is never saved
// either.
const QUOTE_CONTACT_KEY = 'quote-contact';
const CONTACT_FIELDS = ['name', 'email', 'phone'] as const;
const CONTACT_MAX_LENGTH = 320;
type SavedContact = Partial<Pick<QuoteFormParams, (typeof CONTACT_FIELDS)[number]>>;

function readSavedContact(): SavedContact {
  const saved = readSessionStorage(QUOTE_CONTACT_KEY);
  if (!saved) return {};
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const contact: SavedContact = {};
    for (const field of CONTACT_FIELDS) {
      const value = (parsed as Record<string, unknown>)[field];
      if (typeof value === 'string' && value.length <= CONTACT_MAX_LENGTH) contact[field] = value;
    }
    return contact;
  } catch {
    return {};
  }
}

function saveContact(params: QuoteFormParams) {
  const contact: SavedContact = {};
  for (const field of CONTACT_FIELDS) {
    if (params[field].trim()) contact[field] = params[field];
  }
  if (Object.keys(contact).length) writeSessionStorage(QUOTE_CONTACT_KEY, JSON.stringify(contact));
  else removeSessionStorage(QUOTE_CONTACT_KEY);
}

export function useQuoteFormPersistence({
  params,
  setParams,
  currentStep,
  setCurrentStep,
  maxStep,
  onOpen,
}: UseQuoteFormPersistenceOptions) {
  const onOpenRef = useRef(onOpen);
  const sessionIdRef = useRef('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasRestoredRef = useRef(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (process.env.NODE_ENV === 'test') {
      setIsHydrated(true);
      return;
    }

    // Each storage step fails on its own: blocked storage only costs the saved
    // draft; the wizard still gets a session id, the open event, and hydration.
    let restored: Partial<QuoteFormParams> = {};
    const saved = readLocalStorage(QUOTE_PARAMS_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<QuoteFormParams>;
        const sanitized = stripPII(parsed);
        if (sanitized.structureType === 'portable_garage') {
          sanitized.structureType = 'storage_shed';
        }
        if (typeof sanitized.color === 'string') {
          sanitized.color = currentBrandColorHex(sanitized.color);
        }
        restored = sanitized;
      } catch {
        /* ignore */
      }
    }

    // One update: the quote flow's setter reads the draft from a ref that only
    // catches up on the next render, so a second call would drop the first.
    restored = { ...restored, ...readSavedContact() };
    if (Object.keys(restored).length) setParams((prev) => ({ ...prev, ...restored }));

    const savedStep = readLocalStorage(QUOTE_STEP_KEY);
    if (savedStep) {
      const parsedStep = Number.parseInt(savedStep, 10);
      if (
        Number.isInteger(parsedStep) &&
        parsedStep >= 0 &&
        parsedStep <= maxStep
      ) {
        setCurrentStep(parsedStep);
      }
    }

    let sessionId = readLocalStorage(QUOTE_SESSION_KEY);
    if (!sessionId) {
      // Kept in memory for this visit even when the browser refuses the write.
      sessionId = crypto.randomUUID();
      writeLocalStorage(QUOTE_SESSION_KEY, sessionId);
    }
    sessionIdRef.current = sessionId;
    onOpenRef.current?.();
    setIsHydrated(true);
  }, [maxStep, setCurrentStep, setParams]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || !isHydrated) return;

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      writeLocalStorage(QUOTE_PARAMS_KEY, JSON.stringify(stripPII(params)));
      saveContact(params);
      saveTimeout.current = null;
    }, 200);

    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        saveTimeout.current = null;
      }
    };
  }, [isHydrated, params]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test' || !isHydrated) return;
    writeLocalStorage(QUOTE_STEP_KEY, currentStep.toString());
  }, [currentStep, isHydrated]);

  const resetQuoteFormPersistence = useCallback(() => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    removeLocalStorage(QUOTE_PARAMS_KEY);
    removeLocalStorage(QUOTE_STEP_KEY);
    removeSessionStorage(QUOTE_CONTACT_KEY);

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    writeLocalStorage(QUOTE_SESSION_KEY, sessionId);
    onOpenRef.current?.();
  }, []);

  return { sessionIdRef, resetQuoteFormPersistence, isHydrated };
}
