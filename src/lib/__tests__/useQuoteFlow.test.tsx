import { act, renderHook, waitFor } from '@testing-library/react';
import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import type { QuoteFormParams } from '../quoteForm';
import { useQuoteFlow } from '../useQuoteFlow';
import { trackEvent } from '../analytics';
import { trackWebsiteEvent, trackSavedQuoteInClarity } from '../websiteMeasurement';

jest.mock('../websiteMeasurement', () => ({ ...jest.requireActual('../websiteMeasurement'), trackWebsiteEvent: jest.fn(), trackSavedQuoteInClarity: jest.fn() }));

const mockResetQuoteFormPersistence = jest.fn();
// The hook's setParams, as the real persistence hook uses it to restore a saved draft.
const mockPersistence: { setParams?: Dispatch<SetStateAction<QuoteFormParams>> } = {};

jest.mock('../analytics', () => ({
  trackEvent: jest.fn(),
}));

jest.mock('../useQuoteFormPersistence', () => ({
  useQuoteFormPersistence: ({
    setParams,
  }: {
    setParams: Dispatch<SetStateAction<QuoteFormParams>>;
  }) => {
    mockPersistence.setParams = setParams;
    return {
      sessionIdRef: { current: 'session-123' },
      resetQuoteFormPersistence: mockResetQuoteFormPersistence,
    };
  },
}));

const mockBreakdown = {
  base: 100,
  wallHeight: 0,
  roof: 0,
  siding: 0,
  door: 0,
  windows: 0,
  addOns: 0,
  delivery: 0,
  discount: 0,
  interiorUpgrades: [],
};
const mockEstimate = {
  kind: 'build_subtotal' as const,
  delivery: {
    status: 'pending_verification' as const,
    includedInTotal: false as const,
  },
};

describe('useQuoteFlow', () => {
  beforeEach(() => {
    (trackWebsiteEvent as jest.Mock).mockClear();
    (trackSavedQuoteInClarity as jest.Mock).mockClear();
    (trackEvent as jest.Mock).mockClear();
    mockResetQuoteFormPersistence.mockClear();
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'quote-123',
            total: 100,
            breakdown: mockBreakdown,
            estimate: mockEstimate,
          }),
      })
    ) as jest.Mock;
  });

  it('uses 6-foot walls when the flow initializes, selects a structure, and resets', () => {
    const { result } = renderHook(() => useQuoteFlow());

    expect(result.current.state.draft.wallHeight).toBe('6');

    act(() => result.current.actions.setWallHeight('8'));
    act(() => result.current.actions.selectStructureType('storage_shed'));
    expect(result.current.state.draft.wallHeight).toBe('6');

    act(() => result.current.actions.setWallHeight('8'));
    act(() => result.current.actions.resetFlow());
    expect(result.current.state.draft.wallHeight).toBe('6');
    expect(mockResetQuoteFormPersistence).toHaveBeenCalledTimes(1);
  });

  it.each(
    (['greenhouse', 'carport', 'well_pump', 'open_loafing'] as const).flatMap(
      (structureType) => [
        [structureType, 'barn'],
        [structureType, 'lean-to'],
      ]
    )
  )('resets the shed roof style when the building type changes to %s from %s', (
    structureType,
    roofStyle
  ) => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() => result.current.actions.setRoofStyle(roofStyle));
    expect(result.current.state.draft.roofStyle).toBe(roofStyle);

    act(() => result.current.actions.selectStructureType(structureType));

    expect(result.current.state.draft.roofStyle).toBe('gabled');
    expect(result.current.state.viewModel.showRoofStyle).toBe(false);
  });

  it('keeps the roof style when the building type still offers it', () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() => result.current.actions.setRoofStyle('barn'));
    act(() => result.current.actions.selectStructureType('storage_shed'));

    expect(result.current.state.draft.roofStyle).toBe('barn');
  });

  it('drops a stale roof style from a restored draft for a type without a roof choice', () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() =>
      mockPersistence.setParams?.((prev) => ({
        ...prev,
        structureType: 'greenhouse',
        roofStyle: 'barn',
      }))
    );

    expect(result.current.state.draft).toMatchObject({
      structureType: 'greenhouse',
      roofStyle: 'gabled',
    });
  });

  it('syncs the selected ramp add-on when the door changes between shed door types', () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() => result.current.actions.toggleAddOn('Ramp (Single Door)', true));
    expect(result.current.state.draft.addOns).toEqual(['Ramp (Single Door)']);

    act(() =>
      result.current.actions.handleChange({
        target: { name: 'door', value: 'double_shed', type: 'button' },
      } as ChangeEvent<HTMLInputElement>)
    );

    expect(result.current.state.draft.door).toBe('double_shed');
    expect(result.current.state.draft.addOns).toEqual(['Ramp (Double Door)']);
  });

  it('removes the selected ramp add-on when the door does not support ramps', () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() => result.current.actions.toggleAddOn('Ramp (Single Door)', true));

    act(() =>
      result.current.actions.handleChange({
        target: { name: 'door', value: 'garage_roll_up', type: 'button' },
      } as ChangeEvent<HTMLInputElement>)
    );

    expect(result.current.state.draft.door).toBe('garage_roll_up');
    expect(result.current.state.draft.addOns).toEqual([]);
  });

  it('compares another option without clearing contact, delivery, or session context', async () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() => result.current.actions.setDeliveryZip('78205'));
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'name', value: 'Test User', type: 'text' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'email', value: 'info@shed210.com', type: 'email' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'phone', value: '(210) 555-0000', type: 'tel' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'smsConsentOptIn', checked: true, type: 'checkbox' },
      } as ChangeEvent<HTMLInputElement>)
    );

    await act(async () => {
      await result.current.actions.submitQuote();
    });
    await waitFor(() => expect(result.current.state.quote?.id).toBe('quote-123'));

    act(() => result.current.actions.compareAnotherOption());

    expect(result.current.state.currentStep).toBe(0);
    expect(result.current.state.quote).toBeNull();
    expect(result.current.state.draft.name).toBe('Test User');
    expect(result.current.state.draft.email).toBe('info@shed210.com');
    expect(result.current.state.draft.phone).toBe('(210) 555-0000');
    expect(result.current.state.draft.smsConsentOptIn).toBe(true);
    expect(result.current.state.deliveryZip).toBe('78205');
    expect(mockResetQuoteFormPersistence).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.actions.submitQuote();
    });

    const bodies = (global.fetch as jest.Mock).mock.calls.map((call) =>
      JSON.parse((call[1] as RequestInit).body as string)
    );
    expect(bodies).toHaveLength(2);
    expect(bodies[0].session_id).toBe('session-123');
    expect(bodies[1].session_id).toBe('session-123');
  });

  it('tracks quote success and next-step contact actions', async () => {
    const { result } = renderHook(() => useQuoteFlow());

    act(() => result.current.actions.selectStructureType('storage_shed'));
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'name', value: 'Test User', type: 'text' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'email', value: 'info@shed210.com', type: 'email' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'phone', value: '(210) 555-0000', type: 'tel' },
      } as ChangeEvent<HTMLInputElement>)
    );
    act(() =>
      result.current.actions.handleChange({
        target: { name: 'smsConsentOptIn', checked: true, type: 'checkbox' },
      } as ChangeEvent<HTMLInputElement>)
    );

    await act(async () => {
      await result.current.actions.submitQuote();
    });
    await waitFor(() => expect(result.current.state.quote?.id).toBe('quote-123'));

    act(() => result.current.actions.trackTextClick());
    act(() => result.current.actions.trackContactPageClick());

    expect(trackEvent).toHaveBeenCalledWith('quote_success', {
      quoteId: 'quote-123',
      total: 100,
    });
    expect(trackSavedQuoteInClarity).toHaveBeenCalledWith('quote-123');
    expect(trackEvent).toHaveBeenCalledWith('text_click', {
      location: 'quote_next_steps',
      quoteId: 'quote-123',
    });
    expect(trackEvent).toHaveBeenCalledWith('contact_cta_clicked', {
      location: 'quote_next_steps',
      quoteId: 'quote-123',
    });
    expect(trackWebsiteEvent).not.toHaveBeenCalled();
  });

  it('records a validation failure without sending an invalid quote', async () => {
    const { result } = renderHook(() => useQuoteFlow());
    await act(async () => { await result.current.actions.submitQuote(); });
    expect(global.fetch).not.toHaveBeenCalled();
    // No building chosen yet, so the first thing to fix is a selection.
    expect(trackWebsiteEvent).toHaveBeenCalledWith('form_error', { failureCode: 'validation', failureField: 'selection' });
  });

  it('names the consent checkbox, not what was typed, when only consent is missing', async () => {
    const { result } = renderHook(() => useQuoteFlow());
    act(() => result.current.actions.selectStructureType('storage_shed'));
    for (const [name, value, type] of [['name', 'Test User', 'text'], ['email', 'info@shed210.com', 'email'], ['phone', '(210) 555-0000', 'tel']]) {
      act(() => result.current.actions.handleChange({ target: { name, value, type } } as ChangeEvent<HTMLInputElement>));
    }
    await act(async () => { await result.current.actions.submitQuote(); });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(trackWebsiteEvent).toHaveBeenCalledWith('form_error', { failureCode: 'validation', failureField: 'consent' });
    expect(JSON.stringify(jest.mocked(trackWebsiteEvent).mock.calls)).not.toMatch(/Test User|shed210\.com|555/);
  });

  it('invalidates the saved result after the build ZIP changes without clearing contact details', async () => {
    const { result } = renderHook(() => useQuoteFlow());
    act(() => result.current.actions.selectStructureType('storage_shed'));
    for (const [name, value, type] of [['name', 'Test User', 'text'], ['email', 'info@shed210.com', 'email'], ['phone', '(210) 555-0000', 'tel']]) {
      act(() => result.current.actions.handleChange({ target: { name, value, type } } as ChangeEvent<HTMLInputElement>));
    }
    act(() => result.current.actions.handleChange({ target: { name: 'smsConsentOptIn', checked: true, type: 'checkbox' } } as ChangeEvent<HTMLInputElement>));
    act(() => result.current.actions.setDeliveryZip('78205'));
    await act(async () => { await result.current.actions.submitQuote(); });
    expect(result.current.state.quote?.id).toBe('quote-123');
    act(() => result.current.actions.setDeliveryZip('78205'));
    expect(result.current.state.quote?.id).toBe('quote-123');
    act(() => result.current.actions.setDeliveryZip('78209'));
    expect(result.current.state.quote).toBeNull();
    expect(result.current.state.draft.name).toBe('Test User');
    expect(result.current.state.draft.email).toBe('info@shed210.com');
    expect(result.current.state.deliveryZip).toBe('78209');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  function fillValidContact(result: { current: ReturnType<typeof useQuoteFlow> }) {
    act(() => result.current.actions.selectStructureType('storage_shed'));
    for (const [name, value, type] of [['name', 'Test User', 'text'], ['email', 'info@shed210.com', 'email'], ['phone', '(210) 555-0000', 'tel']]) {
      act(() => result.current.actions.handleChange({ target: { name, value, type } } as ChangeEvent<HTMLInputElement>));
    }
    act(() => result.current.actions.handleChange({ target: { name: 'smsConsentOptIn', checked: true, type: 'checkbox' } } as ChangeEvent<HTMLInputElement>));
  }

  it.each([
    [400, 'rejected'],
    [403, 'rejected'],
    [429, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('records a %i response as %s', async (status, failureCode) => {
    const { result } = renderHook(() => useQuoteFlow());
    fillValidContact(result);
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status, json: async () => ({ error: 'Server error' }) });
    await act(async () => { await result.current.actions.submitQuote(); });
    expect(trackWebsiteEvent).toHaveBeenCalledTimes(1);
    expect(trackWebsiteEvent).toHaveBeenCalledWith('form_error', { failureCode });
  });

  it('marks the email field the server rejected until the customer edits it', async () => {
    const { result } = renderHook(() => useQuoteFlow());
    fillValidContact(result);
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid payload', issues: [{ path: ['email'] }] }),
    });
    await act(async () => { await result.current.actions.submitQuote(); });

    expect(result.current.state.errors.email).toBe('Check your email address');
    expect(result.current.state.submissionErrorField).toBe('email');
    expect(result.current.state.submissionError).toBeNull();
    expect(result.current.state.viewModel.isValid).toBe(false);

    act(() => result.current.actions.handleChange({ target: { name: 'email', value: 'maria@shed210.com', type: 'email' } } as ChangeEvent<HTMLInputElement>));
    expect(result.current.state.errors.email).toBeUndefined();
    expect(result.current.state.submissionErrorField).toBeNull();
    expect(result.current.state.viewModel.isValid).toBe(true);
  });

  describe('location prefill', () => {
    let resolvePosition: ((position: GeolocationPosition) => void) | undefined;
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      resolvePosition = success;
    });
    const position = {
      coords: { latitude: 29.4241219, longitude: -98.4936282 },
    } as unknown as GeolocationPosition;

    beforeEach(() => {
      resolvePosition = undefined;
      getCurrentPosition.mockClear();
      Object.defineProperty(global.navigator, 'geolocation', {
        value: { getCurrentPosition } as unknown as Geolocation,
        configurable: true,
        writable: true,
      });
      const quoteResponse = { id: 'quote-123', total: 100, breakdown: mockBreakdown, estimate: mockEstimate };
      global.fetch = jest.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              url === '/api/quote'
                ? quoteResponse
                : { city: 'San Antonio', principalSubdivisionCode: 'US-TX', postcode: '78205' }
            ),
        })
      ) as jest.Mock;
    });

    afterEach(() => {
      delete (global.navigator as { geolocation?: Geolocation }).geolocation;
    });

    const quoteRequests = () =>
      (global.fetch as jest.Mock).mock.calls.filter(([url]) => url === '/api/quote');

    it('asks for a rounded position with a timeout when the customer taps Use Current Location', async () => {
      const { result } = renderHook(() => useQuoteFlow());
      expect(getCurrentPosition).not.toHaveBeenCalled();
      act(() => result.current.actions.requestCurrentLocation());

      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        { timeout: 10000, maximumAge: 300000 }
      );
      await act(async () => { resolvePosition?.(position); });

      await waitFor(() => expect(result.current.state.deliveryZip).toBe('78205'));
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe(
        'https://api-bdc.io/data/reverse-geocode-client?latitude=29.424&longitude=-98.494&localityLanguage=en'
      );
      expect(result.current.state.draft.deliveryAddress).toBe('San Antonio, TX 78205');
      expect(result.current.state.zipLoading).toBe(false);
      expect(result.current.state.locationError).toBeNull();
    });

    it('says location is blocked when the customer denies permission', async () => {
      getCurrentPosition.mockImplementationOnce(
        (_success: PositionCallback, failure?: PositionErrorCallback | null) => {
          failure?.({ code: 1 } as GeolocationPositionError);
        }
      );
      const { result } = renderHook(() => useQuoteFlow());
      act(() => result.current.actions.requestCurrentLocation());

      expect(result.current.state.zipLoading).toBe(false);
      expect(result.current.state.locationError).toMatch(/location is blocked/i);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('says the location was not found when the lookup fails, and clears it on retry', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const { result } = renderHook(() => useQuoteFlow());
      act(() => result.current.actions.requestCurrentLocation());
      await act(async () => { resolvePosition?.(position); });

      await waitFor(() => expect(result.current.state.zipLoading).toBe(false));
      expect(result.current.state.locationError).toMatch(/could not find your location/i);
      expect(result.current.state.deliveryZip).toBe('');

      act(() => result.current.actions.requestCurrentLocation());
      expect(result.current.state.locationError).toBeNull();
      await act(async () => { resolvePosition?.(position); });
      await waitFor(() => expect(result.current.state.deliveryZip).toBe('78205'));
    });

    it('stops waiting when the browser never answers the location request', async () => {
      jest.useFakeTimers();
      try {
        const { result } = renderHook(() => useQuoteFlow());
        act(() => result.current.actions.requestCurrentLocation());
        expect(result.current.state.zipLoading).toBe(true);

        act(() => { jest.advanceTimersByTime(20_000); });
        expect(result.current.state.zipLoading).toBe(false);
        expect(result.current.state.locationError).toMatch(/could not find your location/i);

        // A position that arrives after giving up does not fill the form.
        await act(async () => { resolvePosition?.(position); });
        expect(global.fetch).not.toHaveBeenCalled();
        expect(result.current.state.deliveryZip).toBe('');
      } finally {
        jest.useRealTimers();
      }
    });

    it('drops a lookup that resolves after the quote is shown', async () => {
      const { result } = renderHook(() => useQuoteFlow());
      fillValidContact(result);
      act(() => result.current.actions.requestCurrentLocation());

      await act(async () => { await result.current.actions.submitQuote(); });
      await waitFor(() => expect(result.current.state.quote?.id).toBe('quote-123'));

      await act(async () => { resolvePosition?.(position); });
      await waitFor(() => expect(result.current.state.zipLoading).toBe(false));

      expect(result.current.state.quote?.id).toBe('quote-123');
      expect(result.current.state.deliveryZip).toBe('');
      expect(result.current.state.draft.deliveryAddress).toBe('');
      expect(quoteRequests()).toHaveLength(1);
    });

    it('drops a lookup that resolves while the quote request is in flight', async () => {
      const { result } = renderHook(() => useQuoteFlow());
      fillValidContact(result);
      act(() => result.current.actions.requestCurrentLocation());

      let respond: (() => void) | undefined;
      (global.fetch as jest.Mock).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            respond = () =>
              resolve({
                ok: true,
                json: async () => ({ id: 'quote-123', total: 100, breakdown: mockBreakdown, estimate: mockEstimate }),
              });
          })
      );
      let submitted: Promise<void> | undefined;
      act(() => { submitted = result.current.actions.submitQuote(); });
      await waitFor(() => expect(result.current.state.loading).toBe(true));

      await act(async () => { resolvePosition?.(position); });
      await waitFor(() => expect(result.current.state.zipLoading).toBe(false));
      await act(async () => { respond?.(); await submitted; });

      expect(result.current.state.quote?.id).toBe('quote-123');
      expect(quoteRequests()).toHaveLength(1);
    });

    it('fills the location for a retry when the lookup lands after a failed submit', async () => {
      const { result } = renderHook(() => useQuoteFlow());
      fillValidContact(result);
      act(() => result.current.actions.requestCurrentLocation());

      (global.fetch as jest.Mock).mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: async () => ({ error: 'We could not verify the latest pricing.' }),
        })
      );
      await act(async () => { await result.current.actions.submitQuote(); });
      await waitFor(() => expect(result.current.state.submissionError).toBeTruthy());

      await act(async () => { resolvePosition?.(position); });
      await waitFor(() => expect(result.current.state.zipLoading).toBe(false));

      expect(result.current.state.deliveryZip).toBe('78205');
      expect(result.current.state.draft.deliveryAddress).toBe('San Antonio, TX 78205');
      // The failure stays on screen until the customer acts.
      expect(result.current.state.submissionError).toBeTruthy();
    });
  });

  it('records a network failure without sending form answers to measurement', async () => {
    const { result } = renderHook(() => useQuoteFlow());
    act(() => result.current.actions.selectStructureType('storage_shed'));
    for (const [name, value, type] of [['name', 'Test User', 'text'], ['email', 'info@shed210.com', 'email'], ['phone', '(210) 555-0000', 'tel']]) {
      act(() => result.current.actions.handleChange({ target: { name, value, type } } as ChangeEvent<HTMLInputElement>));
    }
    act(() => result.current.actions.handleChange({ target: { name: 'smsConsentOptIn', checked: true, type: 'checkbox' } } as ChangeEvent<HTMLInputElement>));
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));
    await act(async () => { await result.current.actions.submitQuote(); });
    expect(result.current.state.quote).toBeNull();
    expect(trackWebsiteEvent).toHaveBeenCalledTimes(1);
    expect(trackWebsiteEvent).toHaveBeenCalledWith('form_error', { failureCode: 'network' });
    expect(trackSavedQuoteInClarity).not.toHaveBeenCalled();
  });
});
