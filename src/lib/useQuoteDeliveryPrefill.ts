import { useCallback, useEffect, useRef, useState } from 'react';
import type { QuoteFormParams } from '@/lib/quoteForm';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

type UseQuoteDeliveryPrefillOptions = {
  setDeliveryZip: (zip: string) => void;
  setParams: SetState<QuoteFormParams>;
};

type ReverseGeocodeResult = {
  postcode?: unknown;
  locality?: unknown;
  city?: unknown;
  principalSubdivision?: unknown;
  principalSubdivisionCode?: unknown;
};

function stateLabel(data: ReverseGeocodeResult) {
  if (typeof data.principalSubdivisionCode === 'string') {
    const [, code] = data.principalSubdivisionCode.split('-');
    if (code) return code;
  }

  return stringValue(data.principalSubdivision);
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildAddressSummary(data: ReverseGeocodeResult) {
  const city = stringValue(data.city) ?? stringValue(data.locality);
  const state = stateLabel(data);
  const postcode = stringValue(data.postcode);

  return [city, [state, postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

/**
 * BigDataCloud's free client-side reverse geocoder. Its origin must be in the
 * CSP connect-src (next.config.ts): the old api.bigdatacloud.net host now
 * redirects here, and CSP blocks a redirect to an origin it does not list.
 */
export const REVERSE_GEOCODE_ENDPOINT = 'https://api-bdc.io/data/reverse-geocode-client';

// Three decimals (about 110 m) still resolves the ZIP and city, which is all we use.
const COORDINATE_DECIMALS = 3;
const GEOLOCATION_OPTIONS: PositionOptions = { timeout: 10_000, maximumAge: 300_000 };
/**
 * Some browsers never call back when the permission prompt is dismissed, and
 * the ZIP field stays disabled while locating, so give up after this long.
 */
const LOCATION_REQUEST_LIMIT_MS = 20_000;
/** GeolocationPositionError.PERMISSION_DENIED (the global is missing in jsdom). */
const GEOLOCATION_PERMISSION_DENIED = 1;

export const LOCATION_BLOCKED_MESSAGE =
  'Location is blocked for this site. Type the build address or ZIP instead.';
export const LOCATION_FAILED_MESSAGE =
  'We could not find your location. Type the build address or ZIP instead.';

async function lookupZip(latitude: number, longitude: number) {
  try {
    const resp = await fetch(
      `${REVERSE_GEOCODE_ENDPOINT}?latitude=${latitude.toFixed(COORDINATE_DECIMALS)}&longitude=${longitude.toFixed(COORDINATE_DECIMALS)}&localityLanguage=en`
    );
    if (!resp.ok) return null;

    const data = (await resp.json()) as ReverseGeocodeResult;
    return {
      postcode: typeof data.postcode === 'string' ? data.postcode : null,
      address: buildAddressSummary(data),
    };
  } catch {
    return null;
  }
}

export function useQuoteDeliveryPrefill({
  setDeliveryZip,
  setParams,
}: UseQuoteDeliveryPrefillOptions) {
  const [zipLoading, setZipLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showDeliveryDetails, setShowDeliveryDetails] = useState(false);
  // Each tap gets an id; callbacks from an abandoned request are ignored.
  const requestIdRef = useRef(0);
  const limitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLimitTimer = useCallback(() => {
    if (limitTimerRef.current !== null) {
      clearTimeout(limitTimerRef.current);
      limitTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearLimitTimer, [clearLimitTimer]);

  const applyPosition = useCallback(
    async (position: GeolocationPosition, requestId: number) => {
      const { latitude, longitude } = position.coords;

      const location = await lookupZip(latitude, longitude);
      if (requestId !== requestIdRef.current) return;
      if (!location?.postcode && !location?.address) {
        setLocationError(LOCATION_FAILED_MESSAGE);
        return;
      }
      if (location.postcode) setDeliveryZip(location.postcode);
      if (location.address) {
        const { address } = location;
        setParams((prev) =>
          prev.deliveryAddress.trim()
            ? prev
            : {
                ...prev,
                deliveryAddress: address,
              }
        );
      }
    },
    [setDeliveryZip, setParams]
  );

  /** Only from the Build Location field's button, so the browser asks while they enter a location. */
  const requestCurrentLocation = useCallback(
    () => {
      if (!('geolocation' in navigator)) {
        setLocationError(LOCATION_FAILED_MESSAGE);
        return;
      }

      const requestId = ++requestIdRef.current;
      const isCurrent = () => requestId === requestIdRef.current;
      const finish = () => {
        if (!isCurrent()) return;
        clearLimitTimer();
        setZipLoading(false);
      };

      setLocationError(null);
      setZipLoading(true);
      clearLimitTimer();
      limitTimerRef.current = setTimeout(() => {
        if (!isCurrent()) return;
        requestIdRef.current += 1;
        limitTimerRef.current = null;
        setZipLoading(false);
        setLocationError(LOCATION_FAILED_MESSAGE);
      }, LOCATION_REQUEST_LIMIT_MS);

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          if (!isCurrent()) return;
          try {
            await applyPosition(position, requestId);
          } finally {
            finish();
          }
        },
        (error) => {
          if (!isCurrent()) return;
          setLocationError(
            error.code === GEOLOCATION_PERMISSION_DENIED
              ? LOCATION_BLOCKED_MESSAGE
              : LOCATION_FAILED_MESSAGE
          );
          finish();
        },
        GEOLOCATION_OPTIONS
      );
    },
    [applyPosition, clearLimitTimer]
  );

  const toggleDeliveryDetails = useCallback(() => {
    setShowDeliveryDetails((prev) => !prev);
  }, []);

  return {
    showDeliveryDetails,
    toggleDeliveryDetails,
    requestCurrentLocation,
    zipLoading,
    locationError,
  };
}
