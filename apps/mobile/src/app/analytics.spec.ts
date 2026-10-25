import {
  POSTHOG_HOST,
  POSTHOG_API_KEY,
  posthogOptions,
  getPostHogClient,
  trackEvent,
} from './analytics';

describe('mobile analytics module', () => {
  const originalEnv = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_POSTHOG_API_KEY = originalEnv;
    jest.clearAllMocks();
  });

  it('exports correct EU PostHog host and options', () => {
    expect(POSTHOG_HOST).toBe('https://eu.i.posthog.com');
    expect(posthogOptions.host).toBe('https://eu.i.posthog.com');
    expect(posthogOptions.captureAppLifecycleEvents).toBe(true);
    expect(posthogOptions.enableSessionReplay).toBe(false);
  });

  it('gracefully handles missing API key without throwing', () => {
    expect(() => {
      trackEvent('match_selected', {
        match_id: 123,
        home_team: 'Team A',
        guest_team: 'Team B',
        league: 'Kreisliga A',
        distance_km: 4.2,
      });

      trackEvent('route_clicked', {
        match_id: 123,
        venue_name: 'Sporthalle Mitte',
        has_coordinates: true,
        platform: 'ios',
      });

      trackEvent('location_centered', {
        latitude: 48.7758,
        longitude: 9.1829,
        source: 'user_action',
      });

      trackEvent('matches_refreshed', {
        match_count: 5,
        radius_km: 15,
      });

      trackEvent('filter_changed', {
        filter_name: 'radiusKm',
        value: 20,
      });
    }).not.toThrow();
  });

  it('returns null client when no API key is provided', () => {
    if (!POSTHOG_API_KEY) {
      expect(getPostHogClient()).toBeNull();
    }
  });
});
