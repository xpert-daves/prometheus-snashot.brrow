import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { initialQuoteFormParams, type QuoteFormParams } from '../quoteForm';
import { useQuoteFormPersistence } from '../useQuoteFormPersistence';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAVED_SESSION_ID = '0b5f3a52-8d1e-4c3a-9f6b-2e7d4a1c9b80';

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = value;
}

function renderPersistence() {
  const onOpen = jest.fn();
  const hook = renderHook(() => {
    const [params, setParams] = useState<QuoteFormParams>(initialQuoteFormParams);
    const [currentStep, setCurrentStep] = useState(0);
    const persistence = useQuoteFormPersistence({
      params,
      setParams,
      currentStep,
      setCurrentStep,
      maxStep: 2,
      onOpen,
    });
    return { ...persistence, params, setParams, currentStep, setCurrentStep };
  });
  return { ...hook, onOpen };
}

function blockStorageMethods(error: () => Error) {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    jest.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw error();
    });
  }
}

describe('useQuoteFormPersistence', () => {
  const prevEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // The hook skips storage entirely under NODE_ENV=test.
    setNodeEnv('development');
    jest.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    setNodeEnv(prevEnv);
    localStorage.clear();
    sessionStorage.clear();
  });

  it('restores the saved draft, step, and session id, and saves without contact details', () => {
    localStorage.setItem('quote-params', JSON.stringify({ structureType: 'greenhouse', length: '16' }));
    localStorage.setItem('quote-step', '1');
    localStorage.setItem('quote-session-id', SAVED_SESSION_ID);

    const { result, onOpen } = renderPersistence();

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.params).toMatchObject({ structureType: 'greenhouse', length: '16' });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.sessionIdRef.current).toBe(SAVED_SESSION_ID);
    expect(onOpen).toHaveBeenCalledTimes(1);

    act(() => result.current.setParams((prev) => ({ ...prev, width: '12', name: 'Jane Customer' })));
    act(() => jest.advanceTimersByTime(200));
    const saved = localStorage.getItem('quote-params') ?? '';
    expect(JSON.parse(saved)).toMatchObject({ structureType: 'greenhouse', width: '12' });
    expect(saved).not.toContain('Jane Customer');
  });

  it('keeps name, email and phone for this tab only, and never consent or the build address', () => {
    const first = renderPersistence();
    act(() =>
      first.result.current.setParams((prev) => ({
        ...prev,
        structureType: 'carport',
        name: 'Jane Customer',
        email: 'jane@customer.test',
        phone: '(210) 555-0100',
        smsConsentOptIn: true,
        deliveryAddress: '12 Private Rd',
      }))
    );
    act(() => jest.advanceTimersByTime(200));

    expect(JSON.parse(sessionStorage.getItem('quote-contact') ?? '')).toEqual({
      name: 'Jane Customer',
      email: 'jane@customer.test',
      phone: '(210) 555-0100',
    });
    const longLived = JSON.stringify({ ...localStorage });
    expect(longLived).not.toMatch(/Jane Customer|jane@customer|555-0100|Private Rd/);
    first.unmount();

    // Coming back in the same tab, e.g. after looking at buildings mid-quote.
    const second = renderPersistence();
    expect(second.result.current.params).toMatchObject({
      structureType: 'carport',
      name: 'Jane Customer',
      email: 'jane@customer.test',
      phone: '(210) 555-0100',
      smsConsentOptIn: false,
      deliveryAddress: '',
    });
  });

  it('drops the saved contact when the fields are cleared and when a quote starts over', () => {
    const { result } = renderPersistence();
    act(() => result.current.setParams((prev) => ({ ...prev, name: 'Jane Customer' })));
    act(() => jest.advanceTimersByTime(200));
    expect(sessionStorage.getItem('quote-contact')).not.toBeNull();

    act(() => result.current.setParams((prev) => ({ ...prev, name: '  ' })));
    act(() => jest.advanceTimersByTime(200));
    expect(sessionStorage.getItem('quote-contact')).toBeNull();

    act(() => result.current.setParams((prev) => ({ ...prev, phone: '(210) 555-0100' })));
    act(() => jest.advanceTimersByTime(200));
    act(() => result.current.resetQuoteFormPersistence());
    expect(sessionStorage.getItem('quote-contact')).toBeNull();
  });

  it('ignores a saved contact that is not plain short text', () => {
    sessionStorage.setItem(
      'quote-contact',
      JSON.stringify({ name: 42, email: 'x'.repeat(321), phone: '(210) 555-0100', smsConsentOptIn: true })
    );

    const { result } = renderPersistence();

    expect(result.current.params).toMatchObject({
      name: '',
      email: '',
      phone: '(210) 555-0100',
      smsConsentOptIn: false,
    });
  });

  it.each([
    [
      'the localStorage getter throws (site data blocked)',
      () => {
        jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
          throw new DOMException('Access is denied for this document.', 'SecurityError');
        });
      },
    ],
    [
      'localStorage is null (WebView with DOM storage off)',
      () => {
        jest.spyOn(window, 'localStorage', 'get').mockReturnValue(null as unknown as Storage);
      },
    ],
    [
      'every Storage method throws',
      () => blockStorageMethods(() => new DOMException('The operation is insecure.', 'SecurityError')),
    ],
  ])('still opens the wizard when %s', (_label, blockStorage) => {
    blockStorage();

    const { result, onOpen } = renderPersistence();

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.sessionIdRef.current).toMatch(UUID);
    expect(onOpen).toHaveBeenCalledTimes(1);

    // Later saves and a fresh start must not throw either.
    act(() => result.current.setParams((prev) => ({ ...prev, structureType: 'carport' })));
    act(() => result.current.setCurrentStep(1));
    act(() => jest.advanceTimersByTime(200));

    const firstSessionId = result.current.sessionIdRef.current;
    act(() => result.current.resetQuoteFormPersistence());
    expect(result.current.sessionIdRef.current).toMatch(UUID);
    expect(result.current.sessionIdRef.current).not.toBe(firstSessionId);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps the restored draft and step when only the session id cannot be saved', () => {
    localStorage.setItem('quote-params', JSON.stringify({ structureType: 'greenhouse', length: '16' }));
    localStorage.setItem('quote-step', '1');
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });

    const { result, onOpen } = renderPersistence();

    expect(result.current.isHydrated).toBe(true);
    expect(result.current.params).toMatchObject({ structureType: 'greenhouse', length: '16' });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.sessionIdRef.current).toMatch(UUID);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
