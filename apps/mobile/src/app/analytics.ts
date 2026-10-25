import { PostHog, PostHogOptions } from 'posthog-react-native';

export const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const DEFAULT_POSTHOG_API_KEY =
  'phc_kSUoSJyMiaFgk63LDYRx4MWU34mpN2dP5GXDj5DcaN3p';

/**
 * Expo public environment variable or production client API key fallback
 */
export const POSTHOG_API_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY || DEFAULT_POSTHOG_API_KEY;

export const posthogOptions: PostHogOptions = {
  host: POSTHOG_HOST,
  captureAppLifecycleEvents: true,
  // Ensure anonymized distinct IDs without collecting PII
  enableSessionReplay: false,
  // Suppress native unconfigured network calls when no key is set
  disabled: !POSTHOG_API_KEY,
};

let clientInstance: PostHog | null = null;

/**
 * Returns a singleton PostHog instance if API key is present.
 * If no API key is provided, returns null.
 */
export const getPostHogClient = (): PostHog | null => {
  if (!POSTHOG_API_KEY) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new PostHog(POSTHOG_API_KEY, posthogOptions);
  }

  return clientInstance;
};

export type AnalyticsEventMap = {
  match_selected: {
    match_id: string | number;
    home_team?: string;
    guest_team?: string;
    league?: string;
    distance_km?: number;
  };
  route_clicked: {
    match_id: string | number;
    venue_name?: string;
    has_coordinates: boolean;
    platform: string;
  };
  filter_changed: {
    filter_name: string;
    value: string | number | boolean;
  };
  location_centered: {
    latitude: number;
    longitude: number;
    source: 'user_action' | 'initial_load';
  };
  matches_refreshed: {
    match_count: number;
    radius_km: number;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

/**
 * Type-safe event tracker with graceful fallback / no-op logger when PostHog is disabled.
 */
export const trackEvent = <T extends AnalyticsEventName>(
  eventName: T,
  properties: AnalyticsEventMap[T],
): void => {
  const client = getPostHogClient();

  if (client) {
    try {
      client.capture(eventName, properties);
    } catch {
      // Graceful error handling - never crash the application
    }
  } else if (__DEV__) {
    // Development no-op logger when no PostHog API key is provided
    // eslint-disable-next-line no-console
    console.debug(`[Analytics Mock] Event: "${eventName}"`, properties);
  }
};
