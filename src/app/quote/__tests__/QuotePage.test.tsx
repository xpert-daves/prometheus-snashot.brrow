import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';

const mockStructurePreviewRender = jest.fn();
const mockScrollIntoView = jest.fn();
const mockMatchMedia = jest.fn((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

const mockCaptureException = jest.fn();
let mockUseAppDynamic = false;
// Makes the mocked preview report a moved door once, then crash on a later render.
let mockPreviewReportsThenThrows = false;
let mockPreviewThrowNow = false;

jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));

// Only the real app-router loader below ever imports the preview; fail it like
// a deploy-skew 404 or an interrupted mobile download of the 3D chunk.
jest.mock('../../../components/StructurePreview', () => {
  throw new Error('Loading chunk StructurePreview failed');
});

jest.mock('next/dynamic', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  // The default Jest next/dynamic is the pages-router loader, which hides how
  // the App Router (React.lazy + Suspense) surfaces a rejected chunk.
  const appDynamic = jest.requireActual<{
    default: (
      loader: unknown,
      options?: unknown
    ) => (props: Record<string, unknown>) => unknown;
  }>('next/dist/shared/lib/app-dynamic').default;
  return {
    __esModule: true,
    default: (loader: unknown, options?: { loading?: () => unknown }) => {
      const AppDynamicComponent = appDynamic(loader, options);
      return function DynamicComponent(props: Record<string, unknown>) {
        if (mockUseAppDynamic) {
          return React.createElement(
            AppDynamicComponent as unknown as React.ComponentType<Record<string, unknown>>,
            props
          );
        }
        mockStructurePreviewRender(props);
        const params = props.params as
          | {
              structureType?: string;
              doors?: unknown[];
              windows?: unknown[];
            }
          | undefined;

        if (mockPreviewReportsThenThrows) {
          if (mockPreviewThrowNow) throw new Error('Preview scene failed');
          const onChangeFeatures = props.onChangeFeatures as
            | ((next: { doors: unknown[]; windows: unknown[] }) => void)
            | undefined;
          const doors = (params?.doors ?? []) as Array<{ offset?: number }>;
          const windows = params?.windows ?? [];
          // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed for the test's lifetime
          React.useEffect(() => {
            onChangeFeatures?.({
              doors: doors.map((door) => ({ ...door, offset: (door.offset ?? 0) + 1 })),
              windows,
            });
          }, [onChangeFeatures, doors, windows]);
        }

        if (params) {
          return React.createElement(
            'div',
            {
              'data-testid': 'structure-canvas',
              'data-structure-type': params.structureType,
            },
            `${params.doors?.length ?? 0} doors ${params.windows?.length ?? 0} windows`
          );
        }

        if (options?.loading) {
          return React.createElement('div', { 'data-testid': 'structure-canvas' });
        }
        return null;
      };
    },
  };
});

import { SHED210_DELIVERY_ORIGIN } from '@/lib/location/distance';
import { SMS_QUOTE_CONSENT_TEXT } from '@/lib/smsConsent';
import QuotePage from '../page';
import { QUOTE_RESUME_EVENT } from '@/lib/quoteNavigation';

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  env.NODE_ENV = value;
}

describe('QuotePage validation', () => {
  it('resumes the active step from the sticky price action without clearing inputs', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), { target: { value: 'storage_shed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Materials & Options' }));
    const heading = await screen.findByRole('heading', { name: /materials & options/i });
    await waitFor(() => expect(heading).toHaveFocus());
    mockScrollIntoView.mockClear();
    act(() => window.dispatchEvent(new Event(QUOTE_RESUME_EVENT)));
    await waitFor(() => expect(mockScrollIntoView).toHaveBeenCalled());
    expect(heading).toHaveFocus();
    expect(screen.getByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByLabelText(/structure type/i)).toHaveValue('storage_shed');
  });
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, '', '/quote');
    mockScrollIntoView.mockClear();
    mockMatchMedia.mockClear();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: mockScrollIntoView,
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: mockMatchMedia,
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition: jest.fn() } as unknown as Geolocation,
      writable: true,
    });
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            city: 'San Antonio',
            principalSubdivisionCode: 'US-TX',
            postcode: '12345',
          }),
      })
    ) as jest.Mock;
    window.scrollTo = jest.fn();
    mockStructurePreviewRender.mockClear();
  });

  const getNextButton = () =>
    screen.getByRole('button', { name: /^next:/i });
  const findQuoteButton = async () =>
    screen.findByRole('button', { name: /get quote/i });
  const checkSmsConsent = () =>
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /i agree to receive text messages from shed210/i,
      })
    );
  const fillRequiredContactFields = async () => {
    const detailsButton = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsButton);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
  };

  it('requests a discussion of the saved build without generating another quote', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'saved-build-123',
          discussionToken: 'private-discussion-token',
          total: 100,
          breakdown: { base: 100, roof: 0, siding: 0, door: 0, windows: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, requestId: 'discussion-123', status: 'created' }),
      });
    global.fetch = fetchMock;
    render(<QuotePage />);
    expect(screen.queryByRole('button', { name: 'Ready to schedule this build' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/structure type/i), { target: { value: 'storage_shed' } });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    await fillRequiredContactFields();
    fireEvent.click(await findQuoteButton());
    fireEvent.click(await screen.findByRole('button', { name: 'Ready to schedule this build' }));
    expect(await screen.findByRole('button', { name: 'David knows you’re ready' })).toBeDisabled();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/quote', '/api/quote/discussion']);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      quoteId: 'saved-build-123', actionToken: 'private-discussion-token',
    });
    fireEvent.click(screen.getByRole('button', { name: /compare another option/i }));
    expect(screen.queryByRole('button', { name: 'David knows you’re ready' })).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/structure type/i)).toBeInTheDocument();
  });

  it.each(['storage_shed', 'greenhouse', 'well_pump', 'open_loafing', 'carport'])(
    'preselects %s from a building link on a new quote',
    async (structureType) => {
      window.history.replaceState({}, '', `/quote?structureType=${structureType}`);
      render(<StrictMode><QuotePage /></StrictMode>);

      await waitFor(() => expect(screen.getByLabelText(/structure type/i)).toHaveValue(structureType));
      expect(screen.getByRole('heading', { name: /size & style/i })).toBeInTheDocument();
      expect(screen.queryByLabelText('Building selection')).not.toBeInTheDocument();
      expect(window.location.search).toBe('');

      fireEvent.click(getNextButton());
      expect(await screen.findByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
      act(() => window.dispatchEvent(new Event(QUOTE_RESUME_EVENT)));
      expect(screen.getByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
    }
  );

  it('ignores an unsupported building type in a quote link', () => {
    window.history.replaceState({}, '', '/quote?structureType=warehouse');
    render(<QuotePage />);
    expect(screen.getByLabelText(/structure type/i)).toHaveValue('');
    expect(screen.queryByLabelText('Building selection')).not.toBeInTheDocument();
  });

  it('resumes a matching saved type without resetting its size or step', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    try {
      localStorage.setItem('quote-params', JSON.stringify({
        structureType: 'greenhouse', length: '16', width: '14',
      }));
      localStorage.setItem('quote-step', '1');
      window.history.replaceState({}, '', '/quote?structureType=greenhouse');

      render(<StrictMode><QuotePage /></StrictMode>);

      expect(await screen.findByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
      expect(screen.queryByLabelText('Building selection')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(await screen.findByLabelText(/structure type/i)).toHaveValue('greenhouse');
      expect(screen.getByLabelText(/length \(ft\)/i)).toHaveValue(16);
      expect(screen.getByLabelText(/width \(ft\)/i)).toHaveValue(14);
    } finally {
      setNodeEnv(prevEnv);
    }
  });

  it('keeps a different saved quote until the customer chooses to replace it', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    try {
      localStorage.setItem('quote-params', JSON.stringify({
        structureType: 'storage_shed', length: '16', width: '14', roofStyle: 'barn',
      }));
      localStorage.setItem('quote-step', '1');
      window.history.replaceState({}, '', '/quote?structureType=greenhouse&utm_source=google');

      render(<StrictMode><QuotePage /></StrictMode>);

      expect(await screen.findByLabelText('Building selection')).toHaveTextContent(
        'Starting a new quote clears your current selections and contact details.'
      );
      expect(screen.getByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Keep current quote' }));
      expect(screen.queryByLabelText('Building selection')).not.toBeInTheDocument();
      expect(window.location.search).toBe('?utm_source=google');
      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(await screen.findByLabelText(/structure type/i)).toHaveValue('storage_shed');
      expect(screen.getByLabelText(/length \(ft\)/i)).toHaveValue(16);
      expect(screen.getByLabelText(/width \(ft\)/i)).toHaveValue(14);
      expect(screen.getByRole('button', { name: 'Gambrel' })).toHaveAttribute('aria-pressed', 'true');
    } finally {
      setNodeEnv(prevEnv);
    }
  });

  it('starts the requested type only after an explicit replacement choice', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    try {
      localStorage.setItem('quote-params', JSON.stringify({
        structureType: 'storage_shed', length: '16', width: '14', roofStyle: 'barn',
        windowPackage: '24x36', windowCount: '3',
      }));
      localStorage.setItem('quote-step', '1');
      localStorage.setItem('quote-session-id', 'previous-quote-session');
      window.history.replaceState({}, '', '/quote?structureType=greenhouse');

      render(<QuotePage />);
      fireEvent.click(await screen.findByRole('button', { name: 'Start Greenhouse quote' }));

      expect(await screen.findByLabelText(/structure type/i)).toHaveValue('greenhouse');
      expect(screen.queryByLabelText('Building selection')).not.toBeInTheDocument();
      expect(localStorage.getItem('quote-session-id')).not.toBe('previous-quote-session');
      fireEvent.click(screen.getByRole('button', { name: 'Custom Size' }));
      expect(screen.getByLabelText(/length \(ft\)/i)).toHaveValue(10);
      expect(screen.getByLabelText(/width \(ft\)/i)).toHaveValue(8);
      fireEvent.click(getNextButton());
      expect(await screen.findByRole('button', { name: '24x36' })).toHaveAttribute('aria-pressed', 'false');
    } finally {
      setNodeEnv(prevEnv);
    }
  });

  it('never opens a location dialog on the contact step, restored or entered', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    try {
      localStorage.setItem('quote-params', JSON.stringify({ structureType: 'storage_shed' }));
      localStorage.setItem('quote-step', '2');
      window.history.replaceState({}, '', '/quote?structureType=greenhouse');

      render(<QuotePage />);

      expect(await screen.findByLabelText('Building selection')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Keep current quote' }));
      expect(
        await screen.findByRole('heading', { name: /build location & contact/i })
      ).toBeInTheDocument();
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      await screen.findByRole('heading', { name: /materials & options/i });
      fireEvent.click(getNextButton());
      await screen.findByRole('heading', { name: /build location & contact/i });
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
    } finally {
      setNodeEnv(prevEnv);
    }
  });

  it('shows one guided next action and focuses the missing first field', async () => {
    render(<QuotePage />);

    const nextActions = screen.getAllByRole('button', {
      name: 'Next: Materials & Options',
    });

    expect(nextActions).toHaveLength(1);
    expect(nextActions[0]).toBeEnabled();
    expect(nextActions[0]).toHaveAccessibleDescription(
      'Select a structure to continue.'
    );
    expect(mockScrollIntoView).not.toHaveBeenCalled();

    fireEvent.click(nextActions[0]);
    const structureType = screen.getByLabelText(/structure type/i);
    await waitFor(() => expect(structureType).toHaveFocus());
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('keeps fractional custom sizes on the size step until corrected', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Custom Size' }));
    const length = screen.getByLabelText(/length \(ft\)/i);
    fireEvent.change(length, { target: { value: '10.5' } });

    fireEvent.click(getNextButton());

    expect(screen.getByText('Enter a whole number of feet')).toBeInTheDocument();
    expect(length).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: /size & style/i })).toBeInTheDocument();
    await waitFor(() => expect(length).toHaveFocus());

    fireEvent.change(length, { target: { value: '10' } });
    fireEvent.click(getNextButton());

    expect(await screen.findByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
  });

  it('keeps an excessive window count on the materials step until corrected', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    fireEvent.click(await screen.findByRole('button', { name: '24x36' }));
    const windowCount = screen.getByLabelText(/number of windows/i);
    expect(windowCount).toHaveAttribute('max', '20');
    fireEvent.change(windowCount, { target: { value: '21' } });

    fireEvent.click(getNextButton());

    expect(screen.getByText('Max: 20 windows')).toBeInTheDocument();
    expect(windowCount).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
    await waitFor(() => expect(windowCount).toHaveFocus());

    fireEvent.change(windowCount, { target: { value: '20' } });
    fireEvent.click(getNextButton());

    expect(await screen.findByRole('button', { name: /get quote/i })).toBeInTheDocument();
  });

  it('scrolls to and focuses the Materials heading after advancing', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });

    fireEvent.click(getNextButton());

    const heading = await screen.findByRole('heading', {
      name: /materials & options/i,
    });
    await waitFor(() => expect(heading).toHaveFocus());

    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(mockScrollIntoView).toHaveBeenCalledTimes(1);
    expect(mockScrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(mockScrollIntoView.mock.contexts[0]).toBe(heading);
  });

  it('updates length input', () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    const input = screen.getByLabelText(/length \(ft\)/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '20' } });
    expect(input.value).toBe('20');
  });

  it('displays calculated area', () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    expect(screen.getByText(/80 sq ft/i)).toBeInTheDocument();
    const widthInput = screen.getByLabelText(/width \(ft\)/i);
    fireEvent.change(widthInput, { target: { value: '12' } });
    expect(screen.getByText(/120 sq ft/i)).toBeInTheDocument();
  });

  it('enables next once structure type selected', () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    expect(getNextButton()).toBeEnabled();
  });

  it('selects garage roll up door', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    const btn = await screen.findByRole('button', { name: 'Garage Roll Up' });
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows one door-aware ramp option and submits the single-door ramp SKU', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
              base: 100,
              wallHeight: 0,
              roof: 0,
              siding: 0,
              door: 0,
              windows: 0,
              addOns: 195,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);

    expect(screen.queryByText('Ramp (Single Door)')).not.toBeInTheDocument();
    expect(screen.queryByText('Ramp (Double Door)')).not.toBeInTheDocument();
    const exteriorUpgrades = screen.getByRole('button', {
      name: /exterior upgrades/i,
    });
    fireEvent.click(exteriorUpgrades);
    fireEvent.click(screen.getByRole('checkbox', { name: /ramp single shed door/i }));
    fireEvent.click(exteriorUpgrades);

    fireEvent.click(getNextButton());
    await fillRequiredContactFields();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.addOns).toEqual(['Ramp (Single Door)']);
  });

  it('syncs or clears the selected ramp when the door changes', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
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
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);

    fireEvent.click(screen.getByRole('button', { name: /exterior upgrades/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /ramp single shed door/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Double Shed' }));
    expect(screen.getByRole('checkbox', { name: /ramp double shed door/i })).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: 'Garage Roll Up' }));
    expect(screen.queryByRole('checkbox', { name: /ramp/i })).not.toBeInTheDocument();

    fireEvent.click(getNextButton());
    await fillRequiredContactFields();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.door).toBe('garage_roll_up');
    expect(body.addOns).toEqual([]);
  });

  it('passes selected quote inputs into the read-only structure preview', async () => {
    render(<QuotePage />);

    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(screen.getByRole('button', { name: '8 ft' }));
    fireEvent.click(screen.getByRole('button', { name: /gambrel/i }));
    fireEvent.click(getNextButton());

    await screen.findByText(/door options/i);
    fireEvent.click(await screen.findByRole('button', { name: 'Garage Roll Up' }));
    fireEvent.click(await screen.findByRole('button', { name: '24x36' }));
    fireEvent.change(screen.getByLabelText(/number of windows/i), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Forest' }));

    await waitFor(() => {
      const latestCall =
        mockStructurePreviewRender.mock.calls[
          mockStructurePreviewRender.mock.calls.length - 1
        ];
      const props = latestCall?.[0] as {
        editMode?: boolean;
        showFeatureControls?: boolean;
        syncFeaturesFromProps?: boolean;
        params?: {
          roofStyle?: string;
          wallHeight?: number;
          color?: string;
          doors?: Array<{ width: number; side: string; placement?: string }>;
          windows?: Array<{ side: string; placement?: string }>;
        };
      };

      expect(props.editMode).toBe(false);
      expect(props.showFeatureControls).toBe(false);
      expect(props.syncFeaturesFromProps).toBe(true);
      expect(props.params).toMatchObject({
        roofStyle: 'barn',
        wallHeight: 8,
        color: '#163E1F',
      });
      expect(props.params?.doors).toEqual([
        expect.objectContaining({
          width: 8,
          side: 'front',
          placement: 'default',
        }),
      ]);
      expect(props.params?.windows?.map((window) => window.side)).toEqual([
        'right',
        'left',
      ]);
      expect(props.params?.windows?.every((window) => window.placement === 'default')).toBe(
        true
      );
    });
  });

  it('reveals discount code input when link clicked', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn);
    await screen.findByLabelText(/name/i);
    expect(screen.queryByLabelText(/discount code/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /have a discount code/i }));
    const discountCode = screen.getByLabelText(/discount code/i);
    expect(discountCode).toHaveAttribute('maxLength', '32');
    expect(discountCode).toHaveAttribute('autoCapitalize', 'characters');
    expect(discountCode).toHaveAttribute('autoCorrect', 'off');
    expect(discountCode).toHaveAttribute('spellCheck', 'false');
    expect(screen.getByLabelText(/name/i)).toHaveAttribute('maxLength', '255');
  });

  it('offers call and text when a submission fails, outside the consent text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    });
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    await fillRequiredContactFields();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('maxLength', '255');
    fireEvent.click(await findQuoteButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "We couldn't send your request. Please check your details, or call or text us."
    );
    expect(alert).not.toHaveTextContent('Server error');
    expect(within(alert).getByRole('link', { name: 'Call (855) 578-0944' })).toHaveAttribute(
      'href',
      'tel:+18555780944'
    );
    expect(within(alert).getByRole('link', { name: 'Text (855) 578-0944' })).toHaveAttribute(
      'href',
      'sms:+18555780944'
    );
    await waitFor(() => expect(alert).toHaveFocus());
    const consent = screen.getByRole('checkbox', {
      name: /i agree to receive text messages from shed210/i,
    });
    expect(consent.closest('label')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      SMS_QUOTE_CONSENT_TEXT
    );
  });

  it('marks and focuses the email field when the server rejects the email', async () => {
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: 'Invalid payload',
        issues: [{ code: 'invalid_format', path: ['email'], message: 'Invalid email address' }],
      }),
    });
    global.fetch = fetchSpy;
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    await fillRequiredContactFields();
    const submit = await findQuoteButton();
    fireEvent.click(submit);

    const email = screen.getByLabelText(/email/i);
    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));
    expect(email).toHaveAccessibleDescription('Check your email address');
    await waitFor(() => expect(email).toHaveFocus());
    expect(screen.queryByRole('alert')).toHaveTextContent('Check your email address');
    expect(submit).toHaveAccessibleDescription('Check your email address.');

    fireEvent.click(submit);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fireEvent.change(email, { target: { value: 'maria@shed210.com' } });
    expect(email).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('displays section headers in contact step', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    await screen.findByRole('heading', { name: /build location & contact/i });
    const buildLocationButton = screen.getByRole('button', { name: /^build location$/i });
    expect(buildLocationButton).toBeInTheDocument();
    fireEvent.click(buildLocationButton);
    expect(screen.getByLabelText(/build address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/build zip/i)).toBeInTheDocument();
    expect(screen.getByText(/shed210 builds on your property/i)).toBeInTheDocument();
  });

  it('asks for location only from the Build Location field, then prefills it', async () => {
    const getCurrentPosition = jest.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: SHED210_DELIVERY_ORIGIN.lat,
          longitude: SHED210_DELIVERY_ORIGIN.lng,
        },
      } as unknown as GeolocationPosition);
    });
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition } as unknown as Geolocation,
      writable: true,
    });

    render(<QuotePage />);

    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());

    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(detailsBtn).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(detailsBtn);
    expect(getCurrentPosition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /use current location/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/build zip/i)).toHaveValue('12345')
    );
    expect(screen.getByLabelText(/build address/i)).toHaveValue(
      'San Antonio, TX 12345'
    );
    expect(
      screen.queryByLabelText(/distance from 341 vista rd/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/delivery, travel, and site costs are verified separately/i)
    ).toBeInTheDocument();
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('tells the customer to type the location when location is blocked', async () => {
    const getCurrentPosition = jest.fn(
      (_success: PositionCallback, failure?: PositionErrorCallback | null) => {
        failure?.({ code: 1 } as GeolocationPositionError);
      }
    );
    Object.defineProperty(global.navigator, 'geolocation', {
      value: { getCurrentPosition } as unknown as Geolocation,
      writable: true,
    });

    render(<QuotePage />);

    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());

    fireEvent.click(
      await screen.findByRole('button', { name: /^build location$/i })
    );
    const useLocation = screen.getByRole('button', { name: /use current location/i });
    fireEvent.click(useLocation);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /location is blocked for this site\. type the build address or zip instead\./i
    );
    expect(useLocation).toHaveAccessibleDescription(/location is blocked/i);
    expect(screen.getByLabelText(/build zip/i)).toBeEnabled();
  });

  it('shows loading spinner when fetching', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 123,
            breakdown: {
              base: 100,
              wallHeight: 0,
              roof: 10,
              siding: 0,
              door: 5,
              windows: 0,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn2 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn2);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    const submit = await findQuoteButton();
    fireEvent.click(submit);
    expect(screen.getAllByText(/calculating/i).length).toBeGreaterThan(0);
    await screen.findByText(/price breakdown/i);
  });

  it('shows price breakdown after quote', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 200,
            breakdown: {
              base: 150,
              wallHeight: 0,
              roof: 20,
              siding: 0,
              door: 10,
              windows: 40,
              addOns: 15,
              delivery: 0,
              discount: 0,
              interiorUpgrades: ['Workbench'],
            },
          }),
      })
    ) as jest.Mock;
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn3 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn3);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);
    const baseRow = screen.getByRole('row', { name: /base/i });
    expect(baseRow).toHaveTextContent(/\$150/);
    const upgradesRow = screen.getByRole('row', { name: /upgrades/i });
    expect(upgradesRow).toHaveTextContent(/\$15/);
    const interiorRow = screen.getByText(/workbench/i).closest('tr');
    expect(interiorRow).toHaveTextContent(/priced per job/i);
    const windowsRow = screen.getByRole('row', { name: /windows/i });
    expect(windowsRow).toHaveTextContent(/\$40/);
    expect(
      screen.queryByRole('row', { name: /distance surcharge/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('row', { name: /delivery & site costs/i })
    ).toHaveTextContent(/pending verification/i);
  });

  it('submits phone in E.164 (US) format', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
              base: 100,
              roof: 0,
              siding: 0,
              door: 0,
              windows: 0,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText(/door options/i);
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '+1 (210) 772-3028' },
    });
    checkSmsConsent();
    fireEvent.click(await screen.findByRole('button', { name: /get quote/i }));
    await screen.findByText(/price breakdown/i);

    expect(fetchSpy).toHaveBeenCalled();
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.phone).toBe('+12107723028');
    expect(body.smsConsentOptIn).toBe(true);
  });

  it('submits visual placement metadata reported by the preview', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
              base: 100,
              roof: 0,
              siding: 0,
              door: 0,
              windows: 0,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);

    await waitFor(() => {
      expect(mockStructurePreviewRender).toHaveBeenCalled();
    });
    const latestCall =
      mockStructurePreviewRender.mock.calls[
        mockStructurePreviewRender.mock.calls.length - 1
      ];
    const previewProps = latestCall?.[0] as {
      onChangeFeatures?: (next: { doors: unknown[]; windows: unknown[] }) => void;
      params?: {
        doors?: Array<{ offset: number; placement?: string; side?: string }>;
        windows?: unknown[];
      };
    };

    act(() => {
      previewProps.onChangeFeatures?.({
        doors: [
          {
            ...previewProps.params?.doors?.[0],
            side: 'back',
            offset: 1,
            placement: 'custom',
          },
        ],
        windows: previewProps.params?.windows ?? [],
      });
    });

    fireEvent.click(getNextButton());
    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '+1 (210) 772-3028' },
    });
    checkSmsConsent();
    fireEvent.click(await screen.findByRole('button', { name: /get quote/i }));
    await screen.findByText(/price breakdown/i);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.visualPlacement).toMatchObject({
      customized: true,
      doors: [
        expect.objectContaining({
          side: 'back',
          offset: 1,
          placement: 'custom',
        }),
      ],
    });
  });

  it('requires quote-related consent before submitting an estimate', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
              base: 100,
              roof: 0,
              siding: 0,
              door: 0,
              windows: 0,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    const submit = await screen.findByRole('button', { name: /get quote/i });
    const consent = screen.getByRole('checkbox', {
      name: /i agree to receive text messages from shed210/i,
    });

    expect(submit).toBeEnabled();
    expect(submit).toHaveAccessibleDescription(
      'Check the box to get your online estimate, or call (855) 578-0944 for a quote.'
    );
    expect(consent).not.toBeChecked();
    expect(consent).toBeRequired();
    expect(consent).not.toHaveAttribute('aria-invalid');
    expect(consent).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(consent.closest('label')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      SMS_QUOTE_CONSENT_TEXT
    );
    const consentLabel = consent.closest('label')!;
    for (const href of ['/privacy-policy', '/terms-and-conditions#sms-terms']) {
      const link = consentLabel.querySelector(`a[href="${href}"]`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
      expect(link).toHaveAccessibleName(/opens in a new tab/i);
    }
    expect(consentLabel.querySelector('a[href^="tel:"]')).not.toHaveAttribute('target');

    fireEvent.click(submit);
    expect(fetchSpy).not.toHaveBeenCalled();
    await waitFor(() => expect(consent).toHaveFocus());
    expect(consent).toHaveAttribute('aria-invalid', 'true');
    expect(consent).toHaveAccessibleDescription('Check the box to get your online estimate, or call (855) 578-0944 for a quote.');
    expect(screen.getByRole('alert')).toHaveTextContent('Check the box to get your online estimate, or call (855) 578-0944 for a quote.');

    fireEvent.click(consent);
    expect(consent).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await screen.findByText(/price breakdown/i);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.smsConsentOptIn).toBe(true);
    expect(body.smsMarketingConsentOptIn).toBe(false);
    expect(body.smsConsentTextVersion).toBe('shed210_quote_sms_consent_v4_2026_09_28');
    expect(body).not.toHaveProperty('smsUnifiedConsentOptIn');
  });

  it('submits quote-related SMS consent without enrolling in promotions', async () => {
    const fetchSpy = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
              base: 100,
              roof: 0,
              siding: 0,
              door: 0,
              windows: 0,
              delivery: 0,
              discount: 0,
              interiorUpgrades: [],
            },
          }),
      })
    ) as jest.Mock;
    global.fetch = fetchSpy as unknown as typeof fetch;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    fireEvent.click(await screen.findByRole('button', { name: /get quote/i }));
    await screen.findByText(/price breakdown/i);

    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.smsConsentOptIn).toBe(true);
    expect(body.smsMarketingConsentOptIn).toBe(false);
    expect(body).not.toHaveProperty('smsUnifiedConsentOptIn');
  });

  it('hides $0 line items in price breakdown', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 100,
            breakdown: {
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
            },
          }),
      })
    ) as jest.Mock;
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn4 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn4);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);
    expect(screen.queryByRole('row', { name: /roof/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /siding/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /door/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /windows/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('row', { name: /distance surcharge/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /upgrades/i })).not.toBeInTheDocument();
  });

  it('renders preview canvas when structure selected', async () => {
    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    expect(await screen.findByTestId('structure-canvas')).toBeInTheDocument();
  });

  it('submits default placement, not the stale preview layout, after the preview fails', async () => {
    mockPreviewReportsThenThrows = true;
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'saved-build-789',
        total: 150,
        breakdown: { base: 150, roof: 0, siding: 0, door: 0, windows: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
      }),
    });
    global.fetch = fetchSpy;
    try {
      render(<QuotePage />);
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      await waitFor(() => expect(mockStructurePreviewRender).toHaveBeenCalled());

      mockPreviewThrowNow = true;
      fireEvent.click(getNextButton());
      expect(
        await screen.findByText('3D preview unavailable, your quote still works')
      ).toBeInTheDocument();
      fireEvent.click(getNextButton());
      await fillRequiredContactFields();
      fireEvent.click(await findQuoteButton());
      await screen.findByText(/price breakdown/i);

      const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
      expect(body.visualPlacement.customized).toBe(false);
    } finally {
      mockPreviewReportsThenThrows = false;
      mockPreviewThrowNow = false;
      consoleError.mockRestore();
    }
  });

  it('keeps the quote form when the 3D preview chunk fails to load', async () => {
    mockUseAppDynamic = true;
    mockCaptureException.mockClear();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<QuotePage />);
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });

      expect(
        await screen.findByText('3D preview unavailable, your quote still works')
      ).toBeInTheDocument();
      expect(mockCaptureException).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Loading chunk StructurePreview failed' }),
        expect.objectContaining({ tags: { area: 'quote-preview' } })
      );
      expect(screen.getByLabelText(/structure type/i)).toHaveValue('storage_shed');
      expect(getNextButton()).toBeEnabled();

      fireEvent.click(getNextButton());
      expect(
        await screen.findByRole('heading', { name: /materials & options/i })
      ).toBeInTheDocument();
      expect(screen.getByText('3D preview unavailable, your quote still works')).toBeInTheDocument();
    } finally {
      mockUseAppDynamic = false;
      consoleError.mockRestore();
    }
  });

  it('keeps contact details for the tab only, and never the build address or consent', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    jest.useFakeTimers();

    const { unmount } = render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn5 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn5);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/build address/i), {
      target: { value: '123 Test St, San Antonio, TX 78205' },
    });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
    fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'info@shed210.com' } });
    fireEvent.change(await screen.findByLabelText(/phone/i), { target: { value: '12345' } });

    jest.runAllTimers();
    const saved = JSON.parse(localStorage.getItem('quote-params')!);
    expect(saved).not.toHaveProperty('name');
    expect(saved).not.toHaveProperty('email');
    expect(saved).not.toHaveProperty('phone');
    expect(saved).not.toHaveProperty('deliveryAddress');
    expect(saved).not.toHaveProperty('smsConsentOptIn');
    expect(saved.structureType).toBe('storage_shed');

    const typedPhone = (screen.getByLabelText(/phone/i) as HTMLInputElement).value;
    expect(typedPhone).not.toBe('');
    const longLived = JSON.stringify({ ...localStorage });
    for (const value of ['info@shed210.com', typedPhone, '123 Test St']) expect(longLived).not.toContain(value);

    unmount();

    // Same tab: the contact step comes back filled, the address and consent do not.
    const sameTab = render(<QuotePage />);
    fireEvent.click(screen.getByLabelText(/go to step 1/i));
    expect(
      (screen.getByLabelText(/structure type/i) as HTMLSelectElement).value
    ).toBe('storage_shed');
    fireEvent.click(screen.getByLabelText(/go to step 3/i));
    const detailsBtn6 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn6);
    await screen.findByLabelText(/name/i);
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('Test');
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe('info@shed210.com');
    expect((screen.getByLabelText(/phone/i) as HTMLInputElement).value).toBe(typedPhone);
    expect((screen.getByLabelText(/build address/i) as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('checkbox', { name: /i agree to receive text messages/i })).not.toBeChecked();
    sameTab.unmount();

    // A new tab (or the next person on the device) starts blank.
    sessionStorage.clear();
    render(<QuotePage />);
    fireEvent.click(screen.getByLabelText(/go to step 3/i));
    const detailsBtn7 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn7);
    await screen.findByLabelText(/name/i);
    expect((screen.getByLabelText(/name/i) as HTMLInputElement).value).toBe('');
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/phone/i)).not.toBeInTheDocument();

    jest.useRealTimers();
    setNodeEnv(prevEnv);
  });

  it('requires fresh consent when restoring previously checked legacy and current consent fields', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    localStorage.setItem('quote-params', JSON.stringify({
      structureType: 'storage_shed',
      smsUnifiedConsentOptIn: true,
      smsConsentOptIn: true,
      smsMarketingConsentOptIn: true,
      smsConsentTextVersion: 'shed210_quote_contact_consent_v2_2026_05',
    }));
    localStorage.setItem('quote-step', '2');
    const fetchSpy = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'restored-draft-quote', total: 100,
        breakdown: { base: 100, wallHeight: 0, roof: 0, siding: 0, door: 0, windows: 0, addOns: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
      }),
    });
    global.fetch = fetchSpy;
    const { unmount } = render(<QuotePage />);

    try {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      fireEvent.change(await screen.findByLabelText(/name/i), { target: { value: 'Test User' } });
      fireEvent.change(await screen.findByLabelText(/email/i), { target: { value: 'info@shed210.com' } });
      fireEvent.change(await screen.findByLabelText(/phone/i), { target: { value: '(210) 555-0000' } });
      const consent = screen.getByRole('checkbox', { name: /i agree to receive text messages/i });
      const submit = await findQuoteButton();

      expect(consent).not.toBeChecked();
      fireEvent.click(submit);
      expect(fetchSpy).not.toHaveBeenCalled();
      await waitFor(() => expect(consent).toHaveFocus());

      fireEvent.click(consent);
      fireEvent.click(submit);
      await screen.findByText(/price breakdown/i);
      const body = JSON.parse(fetchSpy.mock.calls[0][1].body as string);
      expect(body).toMatchObject({
        smsConsentOptIn: true,
        smsConsentTextVersion: 'shed210_quote_sms_consent_v4_2026_09_28',
        smsMarketingConsentOptIn: false,
      });
      expect(body).not.toHaveProperty('smsUnifiedConsentOptIn');
    } finally {
      unmount();
      setNodeEnv(prevEnv);
    }
  });

  it('ignores invalid persisted quote steps', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');

    localStorage.setItem(
      'quote-params',
      JSON.stringify({ structureType: 'storage_shed' })
    );
    localStorage.setItem('quote-step', '999');

    render(<QuotePage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/structure type/i)).toBeInTheDocument();
    expect(localStorage.getItem('quote-step')).toBe('0');

    setNodeEnv(prevEnv);
  });

  it('routes a persisted Materials error back to its field before submitting', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    localStorage.setItem(
      'quote-params',
      JSON.stringify({
        structureType: 'storage_shed',
        windowPackage: '24x36',
        windowCount: '0',
      })
    );
    localStorage.setItem('quote-step', '2');

    render(<QuotePage />);

    const submit = await findQuoteButton();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submit).toHaveAccessibleDescription(
      'Review the highlighted Materials option before getting your quote.'
    );
    fireEvent.click(submit);

    expect(
      await screen.findByRole('heading', { name: /materials & options/i })
    ).toBeInTheDocument();
    const windowCount = await screen.findByLabelText(/number of windows/i);
    await waitFor(() => expect(windowCount).toHaveFocus());
    expect(mockScrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    setNodeEnv(prevEnv);
  });

  it('routes a persisted later step without a structure back to Size & Style', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    localStorage.setItem('quote-step', '2');

    render(<QuotePage />);

    const submit = await findQuoteButton();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(submit).toHaveAccessibleDescription(
      'Review Size & Style and select a structure before continuing.'
    );
    fireEvent.click(submit);

    expect(
      await screen.findByRole('heading', { name: /size & style/i })
    ).toBeInTheDocument();
    const structureType = screen.getByLabelText(/structure type/i);
    await waitFor(() => expect(structureType).toHaveFocus());
    expect(mockScrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'center',
    });

    setNodeEnv(prevEnv);
  });

  it('cancels pending saved params when resetting the form', async () => {
    const prevEnv = process.env.NODE_ENV;
    setNodeEnv('development');
    jest.useFakeTimers();

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    fireEvent.click(screen.getByRole('button', { name: /reset form/i }));

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(localStorage.getItem('quote-params')).toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(100);
    });

    expect(JSON.parse(localStorage.getItem('quote-params')!)).toMatchObject({
      structureType: '',
      length: '10',
      width: '8',
    });

    jest.useRealTimers();
    setNodeEnv(prevEnv);
  });

  it('keeps the estimate focused without duplicate contact actions', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 150,
          breakdown: {
            base: 150,
            wallHeight: 0,
            roof: 0,
            siding: 0,
            door: 0,
            windows: 0,
            delivery: 0,
            discount: 0,
            interiorUpgrades: [],
          },
        }),
      })
    ) as jest.Mock;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn7 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn7);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    mockScrollIntoView.mockClear();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);

    const quoteHeading = screen.getByRole('heading', { name: /your quote/i });
    await waitFor(() => expect(quoteHeading).toHaveFocus());
    expect(mockScrollIntoView).toHaveBeenLastCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    const lastScrollIndex = mockScrollIntoView.mock.calls.length - 1;
    expect(mockScrollIntoView.mock.contexts[lastScrollIndex]).toBe(quoteHeading);

    expect(screen.queryByTestId('calendly-widget')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /text us|call us|visit contact page/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compare another option/i })).toBeInTheDocument();
  });

  describe('browser Back and Forward', () => {
    let pushState: jest.SpyInstance;
    let replaceState: jest.SpyInstance;

    beforeEach(() => {
      // The history Next creates when a site link opens /quote.
      window.history.replaceState({}, '', '/');
      window.history.pushState({}, '', '/quote');
      pushState = jest.spyOn(window.history, 'pushState');
      replaceState = jest.spyOn(window.history, 'replaceState');
    });

    afterEach(() => {
      const calls = [...pushState.mock.calls, ...replaceState.mock.calls];
      pushState.mockRestore();
      replaceState.mockRestore();
      // A URL would make Next's patched history methods start a router action.
      expect(calls.map((call) => call[2])).toEqual(calls.map(() => undefined));
    });

    const goBack = (delta = -1) => act(() => window.history.go(delta));

    it('moves between steps and keeps contact details and consent in memory', async () => {
      render(<QuotePage />);
      const pageHeading = screen.getByRole('heading', { level: 1, name: 'Get a Quote' });
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      fireEvent.click(getNextButton());
      await screen.findByRole('heading', { name: /materials & options/i });
      fireEvent.click(getNextButton());
      await fillRequiredContactFields();
      expect(pushState).toHaveBeenCalledTimes(2);

      goBack();
      const materials = await screen.findByRole('heading', { name: /materials & options/i });
      await waitFor(() => expect(materials).toHaveFocus());
      goBack();
      expect(await screen.findByRole('heading', { name: /size & style/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/structure type/i)).toHaveValue('storage_shed');
      expect(window.location.pathname).toBe('/quote');

      act(() => window.history.go(2));
      expect(
        await screen.findByRole('heading', { name: /build location & contact/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toHaveValue('Test User');
      expect(screen.getByLabelText(/email/i)).toHaveValue('info@shed210.com');
      expect(screen.getByLabelText(/phone/i)).toHaveValue('(210) 555-0000');
      expect(
        screen.getByRole('checkbox', { name: /i agree to receive text messages/i })
      ).toBeChecked();
      // Same page instance: a remount would have dropped the contact details.
      expect(screen.getByRole('heading', { level: 1, name: 'Get a Quote' })).toBe(pageHeading);

      // Back from Size & Style still leaves the quote page.
      goBack(-3);
      await waitFor(() => expect(window.location.pathname).toBe('/'));
    });

    it('keeps the in-app Back, stepper jumps, and browser Back on the same history', async () => {
      render(<QuotePage />);
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      fireEvent.click(screen.getByLabelText(/go to step 3/i));
      await screen.findByRole('heading', { name: /build location & contact/i });
      expect(pushState).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByRole('heading', { name: /materials & options/i })).toBeInTheDocument();
      await waitFor(() => expect(window.history.state?.shed210QuoteSteps).toEqual([0, 1]));

      goBack();
      expect(await screen.findByRole('heading', { name: /size & style/i })).toBeInTheDocument();
      goBack();
      await waitFor(() => expect(window.location.pathname).toBe('/'));
    });

    it('does not add history entries for a restored step', async () => {
      const prevEnv = process.env.NODE_ENV;
      setNodeEnv('development');
      try {
        localStorage.setItem('quote-params', JSON.stringify({ structureType: 'storage_shed' }));
        localStorage.setItem('quote-step', '1');

        render(<QuotePage />);

        expect(
          await screen.findByRole('heading', { name: /materials & options/i })
        ).toBeInTheDocument();
        expect(pushState).not.toHaveBeenCalled();

        // Going back below the restored step stays in the wizard, then leaves.
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(await screen.findByRole('heading', { name: /size & style/i })).toBeInTheDocument();
        expect(pushState).not.toHaveBeenCalled();
        goBack();
        await waitFor(() => expect(window.location.pathname).toBe('/'));
      } finally {
        setNodeEnv(prevEnv);
      }
    });

    it('clears the shown price on Back from the result and keeps contact details', async () => {
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'saved-build-123',
          total: 150,
          breakdown: { base: 150, roof: 0, siding: 0, door: 0, windows: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
        }),
      });
      global.fetch = fetchSpy;
      render(<QuotePage />);
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      fireEvent.click(getNextButton());
      await screen.findByText(/door options/i);
      fireEvent.click(getNextButton());
      await fillRequiredContactFields();
      fireEvent.click(await findQuoteButton());
      await screen.findByText(/price breakdown/i);
      // The result adds no history entry, so there is no dead Back or Forward on it.
      expect(pushState).toHaveBeenCalledTimes(2);

      goBack();
      const materials = await screen.findByRole('heading', { name: /materials & options/i });
      await waitFor(() => expect(materials).toHaveFocus());
      expect(screen.queryByText(/price breakdown/i)).not.toBeInTheDocument();

      act(() => window.history.go(1));
      expect(
        await screen.findByRole('heading', { name: /build location & contact/i })
      ).toBeInTheDocument();
      expect(screen.queryByText(/price breakdown/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/name/i)).toHaveValue('Test User');
      expect(
        screen.getByRole('checkbox', { name: /i agree to receive text messages/i })
      ).toBeChecked();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("keeps Next's router marker on wizard entries after a fragment link empties history.state", async () => {
      // What Next stamps on /quote; it reloads the page when it pops an entry without __NA.
      const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ['quote'] } };
      window.history.replaceState(routerState, '');
      render(<QuotePage />);

      // "Skip to content" adds a fragment entry whose state is null.
      act(() => {
        window.location.hash = 'main';
      });
      await waitFor(() => expect(window.history.state?.__NA).toBeUndefined());

      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      fireEvent.click(getNextButton());
      await screen.findByRole('heading', { name: /materials & options/i });

      expect(window.history.state).toMatchObject({ ...routerState, shed210QuoteSteps: [0, 1] });
      expect(replaceState.mock.calls.at(-1)?.[0]).toMatchObject({ __NA: true });
    });

    it('stays on the contact step when Back is pressed while the quote is saving', async () => {
      let resolveFetch: (value: unknown) => void = () => {};
      const fetchSpy = jest.fn(
        () => new Promise((resolve) => {
          resolveFetch = resolve;
        })
      );
      global.fetch = fetchSpy as unknown as typeof fetch;
      render(<QuotePage />);
      fireEvent.change(screen.getByLabelText(/structure type/i), {
        target: { value: 'storage_shed' },
      });
      fireEvent.click(getNextButton());
      await screen.findByText(/door options/i);
      fireEvent.click(getNextButton());
      await fillRequiredContactFields();
      fireEvent.click(await findQuoteButton());
      await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));

      // history.go is asynchronous; wait for the pop the page handles first.
      const popped = new Promise<void>((resolve) =>
        window.addEventListener('popstate', () => resolve(), { once: true })
      );
      goBack();
      await act(async () => {
        await popped;
      });
      expect(window.history.state?.shed210QuoteSteps).toEqual([0, 1, 2]);
      expect(screen.getByRole('heading', { name: /build location & contact/i })).toBeInTheDocument();

      await act(async () => {
        resolveFetch({
          ok: true,
          json: async () => ({
            id: 'saved-build-456',
            total: 150,
            breakdown: { base: 150, roof: 0, siding: 0, door: 0, windows: 0, delivery: 0, discount: 0, interiorUpgrades: [] },
          }),
        });
      });
      await screen.findByText(/price breakdown/i);
      expect(screen.getByRole('heading', { name: /build location & contact/i })).toBeInTheDocument();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('allows comparing another option from the result state', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 1,
            total: 150,
          breakdown: {
            base: 150,
            wallHeight: 0,
            roof: 0,
            siding: 0,
            door: 0,
            windows: 0,
            delivery: 0,
            discount: 0,
            interiorUpgrades: [],
          },
        }),
      })
    ) as jest.Mock;

    render(<QuotePage />);
    fireEvent.change(screen.getByLabelText(/structure type/i), {
      target: { value: 'storage_shed' },
    });
    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    const detailsBtn8 = await screen.findByRole('button', { name: /^build location$/i });
    fireEvent.click(detailsBtn8);
    await screen.findByLabelText(/name/i);
    fireEvent.change(screen.getByLabelText(/build zip/i), {
      target: { value: '78205' },
    });
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test User' },
    });
    fireEvent.change(await screen.findByLabelText(/email/i), {
      target: { value: 'info@shed210.com' },
    });
    fireEvent.change(await screen.findByLabelText(/phone/i), {
      target: { value: '(210) 555-0000' },
    });
    checkSmsConsent();
    fireEvent.click(await findQuoteButton());
    await screen.findByText(/price breakdown/i);

    fireEvent.click(screen.getByRole('button', { name: /compare another option/i }));
    expect(await screen.findByLabelText(/structure type/i)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Quote actions' })).not.toBeInTheDocument();

    fireEvent.click(getNextButton());
    await screen.findByText(/door options/i);
    fireEvent.click(getNextButton());
    expect(await screen.findByLabelText(/name/i)).toHaveValue('Test User');
    expect(await screen.findByLabelText(/email/i)).toHaveValue('info@shed210.com');
    expect(await screen.findByLabelText(/phone/i)).toHaveValue('(210) 555-0000');
    expect(screen.getByRole('checkbox', { name: /i agree to receive text messages/i })).toBeChecked();
    expect(await screen.findByLabelText(/build zip/i)).toHaveValue('78205');
  });
});
