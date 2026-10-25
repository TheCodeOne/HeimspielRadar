import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PostHogProvider } from 'posthog-react-native';
import type MapView from 'react-native-maps';

import * as Location from 'expo-location';
import type { Match } from '@sundayleague/shared-types';
import { NativeMap } from './NativeMap';
import { MatchPreviewCard } from './MatchPreviewCard';
import { FloatingHeaderPill } from './FloatingHeaderPill';
import { FloatingActionControls } from './FloatingActionControls';
import { useNetworkStatus } from './useNetworkStatus';
import {
  saveCachedMatches,
  getCachedMatches,
} from './matchCache';
import {
  POSTHOG_API_KEY,
  posthogOptions,
  trackEvent,
} from './analytics';
import {
  LocationCoordinates,
  STUTTGART_FALLBACK,
  DEFAULT_RADIUS_KM,
  getSampleMatchesMobile,
  calculateDistanceKm,
} from './data';

export const App = () => {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  const mapRef = useRef<MapView | null>(null);
  const network = useNetworkStatus();
  const wasOfflineRef = useRef<boolean>(false);

  // 1. Initial Load: Read cached matches first for immediate offline availability
  useEffect(() => {
    async function loadInitialCache() {
      const cached = await getCachedMatches();

      if (cached && cached.matches.length > 0) {
        setMatches(cached.matches);

        if (!location) {
          setLocation(cached.coords);
        }
      }
    }

    loadInitialCache();
  }, []); // Run once on startup

  // 2. Geolocation Request
  const requestLocation = useCallback(async () => {
    setIsLocating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocation((prev) => prev ?? STUTTGART_FALLBACK);
        setIsLocating(false);

        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      };

      setLocation(coords);
      trackEvent('location_centered', {
        latitude: coords.latitude,
        longitude: coords.longitude,
        source: 'initial_load',
      });
      setIsLocating(false);
    } catch {
      setPermissionDenied(true);
      setLocation((prev) => prev ?? STUTTGART_FALLBACK);
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // 3. Fetch matches (API -> Cache -> Fallback)
  const fetchMatchesForLocation = useCallback(
    async (coords: LocationCoordinates, isManualOrForced = false) => {
      // If we know we are offline, immediately serve cache or fallback without network delay
      if (!network.isOnline && !isManualOrForced) {
        setIsOfflineMode(true);
        const cached = await getCachedMatches();

        if (cached && cached.matches.length > 0) {
          setMatches(cached.matches);
        } else {
          setMatches(getSampleMatchesMobile());
        }

        setIsLoadingMatches(false);

        return;
      }

      setIsLoadingMatches(true);

      try {
        const apiUrl = `http://localhost:3000/api/matches?lat=${coords.latitude}&lng=${coords.longitude}&radiusKm=${DEFAULT_RADIUS_KM}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(apiUrl, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data: Match[] = await response.json();
          setMatches(data);
          setIsOfflineMode(false);
          // Persist to cache on successful fetch
          await saveCachedMatches(data, coords, DEFAULT_RADIUS_KM);
        } else {
          // If server error, check cache first
          const cached = await getCachedMatches();

          if (cached && cached.matches.length > 0) {
            setMatches(cached.matches);
            setIsOfflineMode(true);
          } else {
            setMatches(getSampleMatchesMobile());
            setIsOfflineMode(!network.isOnline);
          }
        }
      } catch {
        // Network error / timeout / unreachable
        const cached = await getCachedMatches();

        if (cached && cached.matches.length > 0) {
          setMatches(cached.matches);
        } else {
          setMatches(getSampleMatchesMobile());
        }

        setIsOfflineMode(true);
      } finally {
        setIsLoadingMatches(false);
      }
    },
    [network.isOnline],
  );

  useEffect(() => {
    if (location) {
      fetchMatchesForLocation(location);
    }
  }, [location, fetchMatchesForLocation]);

  // 4. Background revalidation when network transitions from offline to online
  useEffect(() => {
    if (!network.isOnline) {
      wasOfflineRef.current = true;
      setIsOfflineMode(true);
    } else if (wasOfflineRef.current && network.isOnline) {
      // Back online!
      wasOfflineRef.current = false;
      const targetCoords = location ?? STUTTGART_FALLBACK;
      fetchMatchesForLocation(targetCoords, true);
    }
  }, [network.isOnline, location, fetchMatchesForLocation]);

  // Recenter Map Handler
  const handleRecenter = useCallback(() => {
    const target = location ?? STUTTGART_FALLBACK;

    trackEvent('location_centered', {
      latitude: target.latitude,
      longitude: target.longitude,
      source: 'user_action',
    });

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: 0.25,
        longitudeDelta: 0.25,
      });
    }
  }, [location]);

  // Refresh Matches Handler
  const handleRefresh = useCallback(() => {
    trackEvent('matches_refreshed', {
      match_count: matches.length,
      radius_km: DEFAULT_RADIUS_KM,
    });

    const target = location ?? STUTTGART_FALLBACK;
    fetchMatchesForLocation(target, true);
  }, [location, matches.length, fetchMatchesForLocation]);

  // Selected match distance
  const selectedMatchDistance = useMemo(() => {
    if (
      !selectedMatch?.venue?.latitude ||
      !selectedMatch?.venue?.longitude ||
      !location
    ) {
      return undefined;
    }

    return calculateDistanceKm(
      location.latitude,
      location.longitude,
      selectedMatch.venue.latitude,
      selectedMatch.venue.longitude,
    );
  }, [selectedMatch, location]);

  // Match selection handler
  const handleSelectMatch = useCallback(
    (match: Match) => {
      setSelectedMatch(match);

      const distance =
        match.venue?.latitude && match.venue?.longitude && location
          ? calculateDistanceKm(
              location.latitude,
              location.longitude,
              match.venue.latitude,
              match.venue.longitude,
            )
          : undefined;

      trackEvent('match_selected', {
        match_id: match.id,
        home_team: match.homeTeam?.name,
        guest_team: match.guestTeam?.name,
        league: match.league?.name,
        distance_km: distance !== undefined ? Number(distance.toFixed(1)) : undefined,
      });
    },
    [location],
  );

  if (isLocating && !location) {
    return (
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={posthogOptions}
        autocapture={true}
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.centerContainer}>
            <StatusBar barStyle="dark-content" />
            <ActivityIndicator size="large" color="#0284c7" />
            <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
          </SafeAreaView>
        </SafeAreaProvider>
      </PostHogProvider>
    );
  }

  const activeRegion = location ?? STUTTGART_FALLBACK;

  return (
    <PostHogProvider
      apiKey={POSTHOG_API_KEY}
      options={posthogOptions}
      autocapture={true}
    >
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <StatusBar barStyle="dark-content" />

          {/* Main Fullscreen Interactive Map */}
          <View style={styles.mapContainer}>
            <NativeMap
              mapRef={mapRef}
              initialRegion={activeRegion}
              radiusKm={DEFAULT_RADIUS_KM}
              matches={matches}
              selectedMatch={selectedMatch}
              onSelectMatch={handleSelectMatch}
            />

            {/* Floating Safe-Area Header Pill */}
            <FloatingHeaderPill
              matchCount={matches.length}
              radiusKm={DEFAULT_RADIUS_KM}
              isLoading={isLoadingMatches}
              permissionDenied={permissionDenied}
              isOffline={isOfflineMode || !network.isOnline}
            />

            {/* Floating Action Controls (Recenter, Reload) */}
            <FloatingActionControls
              onRecenter={handleRecenter}
              onRefresh={handleRefresh}
              isRefreshing={isLoadingMatches}
            />

            {/* Floating Glassmorphism Match Preview Card */}
            {selectedMatch && (
              <MatchPreviewCard
                match={selectedMatch}
                distanceKm={selectedMatchDistance}
                onClose={() => setSelectedMatch(null)}
              />
            )}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </PostHogProvider>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '500',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
});

export default App;
