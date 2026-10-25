import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type MapView from 'react-native-maps';

import * as Location from 'expo-location';
import type { Match } from '@sundayleague/shared-types';
import { NativeMap } from './NativeMap';
import { MatchPreviewCard } from './MatchPreviewCard';
import { FloatingHeaderPill } from './FloatingHeaderPill';
import { FloatingActionControls } from './FloatingActionControls';
import { FilterChips } from './FilterChips';
import { useNetworkStatus } from './useNetworkStatus';
import {
  saveCachedMatches,
  getCachedMatches,
} from './matchCache';
import {
  LocationCoordinates,
  STUTTGART_FALLBACK,
  RadiusOption,
  DateFilterOption,
  DEFAULT_FILTER_PREFERENCES,
  getBerlinDateString,
  getWeekendBerlinDates,
  getSampleMatchesMobile,
  calculateDistanceKm,
} from './data';
import {
  loadFilterPreferences,
  saveFilterPreferences,
} from './storage';

export const App = () => {
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState<boolean>(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Filter state with defaults
  const [radiusKm, setRadiusKm] = useState<RadiusOption>(
    DEFAULT_FILTER_PREFERENCES.radiusKm,
  );

  const [dateFilter, setDateFilter] = useState<DateFilterOption>(
    DEFAULT_FILTER_PREFERENCES.dateFilter,
  );

  const [isStorageLoaded, setIsStorageLoaded] = useState<boolean>(false);

  const mapRef = useRef<MapView | null>(null);
  const network = useNetworkStatus();
  const wasOfflineRef = useRef<boolean>(false);

  // 1. Load initial cache & persisted filter preferences on mount
  useEffect(() => {
    let isMounted = true;

    async function init() {
      const [cached, prefs] = await Promise.all([
        getCachedMatches(),
        loadFilterPreferences(),
      ]);

      if (isMounted) {
        if (cached && cached.matches.length > 0) {
          setMatches(cached.matches);

          if (!location) {
            setLocation(cached.coords);
          }
        }

        setRadiusKm(prefs.radiusKm);
        setDateFilter(prefs.dateFilter);
        setIsStorageLoaded(true);
      }
    }

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Geolocation Request
  const requestLocation = useCallback(async () => {
    setIsLocating(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocation(STUTTGART_FALLBACK);
        setIsLocating(false);

        return;
      }

      const currentPosition = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: currentPosition.coords.latitude,
        longitude: currentPosition.coords.longitude,
      });
      setIsLocating(false);
    } catch {
      setPermissionDenied(true);
      setLocation(STUTTGART_FALLBACK);
      setIsLocating(false);
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // 3. Filtering logic for cached or sample matches
  const filterMatchesLocally = useCallback(
    (
      pool: Match[],
      coords: LocationCoordinates,
      radius: number,
      dateMode: DateFilterOption,
    ): Match[] => {
      const todayStr = getBerlinDateString(0);
      const tomorrowStr = getBerlinDateString(1);
      const { saturdayStr, sundayStr } = getWeekendBerlinDates();

      return pool.filter((match) => {
        // Distance check
        if (match.venue?.latitude && match.venue?.longitude) {
          const dist = calculateDistanceKm(
            coords.latitude,
            coords.longitude,
            match.venue.latitude,
            match.venue.longitude,
          );

          if (dist > radius) {
            return false;
          }
        }

        // Date check (Europe/Berlin kickoffDate)
        if (dateMode === 'today') {
          return match.kickoffDate === todayStr;
        }

        if (dateMode === 'tomorrow') {
          return match.kickoffDate === tomorrowStr;
        }

        if (dateMode === 'weekend') {
          return (
            match.kickoffDate === saturdayStr || match.kickoffDate === sundayStr
          );
        }

        return true;
      });
    },
    [],
  );

  // 4. Fetch matches (API -> Cache -> Fallback)
  const fetchMatchesForLocation = useCallback(
    async (
      coords: LocationCoordinates,
      radius: RadiusOption,
      dateMode: DateFilterOption,
      isManualOrForced = false,
    ) => {
      // If we know we are offline, immediately serve cache or sample fallback without network timeout
      if (!network.isOnline && !isManualOrForced) {
        setIsOfflineMode(true);
        const cached = await getCachedMatches();

        if (cached && cached.matches.length > 0) {
          setMatches(filterMatchesLocally(cached.matches, coords, radius, dateMode));
        } else {
          const samples = getSampleMatchesMobile();
          setMatches(filterMatchesLocally(samples, coords, radius, dateMode));
        }

        setIsLoadingMatches(false);

        return;
      }

      setIsLoadingMatches(true);

      const todayStr = getBerlinDateString(0);
      const tomorrowStr = getBerlinDateString(1);
      const { saturdayStr, sundayStr } = getWeekendBerlinDates();

      let queryParams = `lat=${coords.latitude}&lng=${coords.longitude}&radiusKm=${radius}`;

      if (dateMode === 'today') {
        queryParams += `&date=${todayStr}`;
      } else if (dateMode === 'tomorrow') {
        queryParams += `&date=${tomorrowStr}`;
      } else if (dateMode === 'weekend') {
        queryParams += `&dateFrom=${saturdayStr}&dateTo=${sundayStr}`;
      }

      try {
        const apiUrl = `http://localhost:3000/api/matches?${queryParams}`;
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
          await saveCachedMatches(data, coords, radius);
        } else {
          // If server error, check cache first
          const cached = await getCachedMatches();

          if (cached && cached.matches.length > 0) {
            setMatches(filterMatchesLocally(cached.matches, coords, radius, dateMode));
            setIsOfflineMode(true);
          } else {
            const samples = getSampleMatchesMobile();
            setMatches(filterMatchesLocally(samples, coords, radius, dateMode));
            setIsOfflineMode(!network.isOnline);
          }
        }
      } catch {
        // Network error / timeout / unreachable
        const cached = await getCachedMatches();

        if (cached && cached.matches.length > 0) {
          setMatches(filterMatchesLocally(cached.matches, coords, radius, dateMode));
        } else {
          const samples = getSampleMatchesMobile();
          setMatches(filterMatchesLocally(samples, coords, radius, dateMode));
        }

        setIsOfflineMode(true);
      } finally {
        setIsLoadingMatches(false);
      }
    },
    [filterMatchesLocally, network.isOnline],
  );

  useEffect(() => {
    if (location && isStorageLoaded) {
      fetchMatchesForLocation(location, radiusKm, dateFilter);
    }
  }, [location, isStorageLoaded, radiusKm, dateFilter, fetchMatchesForLocation]);

  // Handle radius selection & persist
  const handleSelectRadius = useCallback(
    (newRadius: RadiusOption) => {
      setRadiusKm(newRadius);
      saveFilterPreferences({ radiusKm: newRadius, dateFilter });
    },
    [dateFilter],
  );

  // Handle date filter selection & persist
  const handleSelectDate = useCallback(
    (newDate: DateFilterOption) => {
      setDateFilter(newDate);
      saveFilterPreferences({ radiusKm, dateFilter: newDate });
    },
    [radiusKm],
  );

  // Background revalidation when network transitions from offline to online
  useEffect(() => {
    if (!network.isOnline) {
      wasOfflineRef.current = true;
      setIsOfflineMode(true);
    } else if (wasOfflineRef.current && network.isOnline) {
      // Back online!
      wasOfflineRef.current = false;
      const targetCoords = location ?? STUTTGART_FALLBACK;
      fetchMatchesForLocation(targetCoords, radiusKm, dateFilter, true);
    }
  }, [network.isOnline, location, radiusKm, dateFilter, fetchMatchesForLocation]);

  // Recenter Map Handler
  const handleRecenter = useCallback(() => {
    const target = location ?? STUTTGART_FALLBACK;

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: target.latitude,
        longitude: target.longitude,
        latitudeDelta: radiusKm > 25 ? 0.6 : 0.25,
        longitudeDelta: radiusKm > 25 ? 0.6 : 0.25,
      });
    }
  }, [location, radiusKm]);

  // Refresh Matches Handler
  const handleRefresh = useCallback(() => {
    const target = location ?? STUTTGART_FALLBACK;
    fetchMatchesForLocation(target, radiusKm, dateFilter, true);
  }, [location, radiusKm, dateFilter, fetchMatchesForLocation]);

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

  if (isLocating && !location) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centerContainer}>
          <StatusBar barStyle="dark-content" />
          <ActivityIndicator size="large" color="#0284c7" />
          <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const activeRegion = location ?? STUTTGART_FALLBACK;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />

        {/* Main Fullscreen Interactive Map */}
        <View style={styles.mapContainer}>
          <NativeMap
            mapRef={mapRef}
            initialRegion={activeRegion}
            radiusKm={radiusKm}
            matches={matches}
            selectedMatch={selectedMatch}
            onSelectMatch={(match) => setSelectedMatch(match)}
          />

          {/* Floating Safe-Area Header Pill */}
          <FloatingHeaderPill
            matchCount={matches.length}
            radiusKm={radiusKm}
            isLoading={isLoadingMatches}
            permissionDenied={permissionDenied}
            isOffline={isOfflineMode || !network.isOnline}
          />

          {/* Floating Filter Bar (Radius & Date Chips) */}
          <FilterChips
            selectedRadius={radiusKm}
            onSelectRadius={handleSelectRadius}
            selectedDate={dateFilter}
            onSelectDate={handleSelectDate}
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
