import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import type MapView from 'react-native-maps';
import * as Location from 'expo-location';
import type { Match } from '@sundayleague/shared-types';
import { NativeMap } from './NativeMap';
import { MatchPreviewCard } from './MatchPreviewCard';
import { FloatingHeaderPill } from './FloatingHeaderPill';
import { FloatingActionControls } from './FloatingActionControls';
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

  const mapRef = useRef<MapView | null>(null);

  // 1. Geolocation Request
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

  // 2. Fetch matches (API or sample fallback)
  const fetchMatchesForLocation = useCallback(
    async (coords: LocationCoordinates) => {
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
        } else {
          setMatches(getSampleMatchesMobile());
        }
      } catch {
        setMatches(getSampleMatchesMobile());
      } finally {
        setIsLoadingMatches(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (location) {
      fetchMatchesForLocation(location);
    }
  }, [location, fetchMatchesForLocation]);

  // Recenter Map Handler
  const handleRecenter = useCallback(() => {
    const target = location ?? STUTTGART_FALLBACK;
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
    if (location) {
      fetchMatchesForLocation(location);
    }
  }, [location, fetchMatchesForLocation]);

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
      <SafeAreaView style={styles.centerContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#0284c7" />
        <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
      </SafeAreaView>
    );
  }

  const activeRegion = location ?? STUTTGART_FALLBACK;

  return (
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
          onSelectMatch={(match) => setSelectedMatch(match)}
        />

        {/* Floating Safe-Area Header Pill */}
        <FloatingHeaderPill
          matchCount={matches.length}
          radiusKm={DEFAULT_RADIUS_KM}
          isLoading={isLoadingMatches}
          permissionDenied={permissionDenied}
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
