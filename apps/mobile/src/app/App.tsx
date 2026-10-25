import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import type { Match } from '@sundayleague/shared-types';
import { NativeMap } from './NativeMap';
import { MatchPreviewSheet } from './MatchPreviewSheet';
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

  // 1. Geolocation Request
  useEffect(() => {
    let isMounted = true;

    async function requestLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (isMounted) {
            setPermissionDenied(true);
            setLocation(STUTTGART_FALLBACK);
            setIsLocating(false);
          }

          return;
        }

        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (isMounted) {
          setLocation({
            latitude: currentPosition.coords.latitude,
            longitude: currentPosition.coords.longitude,
          });
          setIsLocating(false);
        }
      } catch {
        if (isMounted) {
          setPermissionDenied(true);
          setLocation(STUTTGART_FALLBACK);
          setIsLocating(false);
        }
      }
    }

    requestLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch matches (API or sample fallback)
  const fetchMatchesForLocation = useCallback(
    async (coords: LocationCoordinates) => {
      setIsLoadingMatches(true);

      try {
        // Attempt to fetch from backend API if available, otherwise fallback
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
        // Network error or local dev environment without backend running: use fallback
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

      {/* Header bar */}
      <View style={styles.headerBar}>
        <View>
          <Text style={styles.headerTitle}>HeimspielRadar</Text>
          <Text style={styles.headerSubtitle}>
            {permissionDenied
              ? 'Standort verweigert (Fallback: Stuttgart)'
              : `Umkreis ${DEFAULT_RADIUS_KM} km`}
          </Text>
        </View>

        {isLoadingMatches && (
          <ActivityIndicator size="small" color="#0284c7" />
        )}
      </View>

      {/* Interactive Map */}
      <View style={styles.mapContainer}>
        <NativeMap
          initialRegion={activeRegion}
          radiusKm={DEFAULT_RADIUS_KM}
          matches={matches}
          selectedMatch={selectedMatch}
          onSelectMatch={(match) => setSelectedMatch(match)}
        />

        {/* Selected Match Preview Sheet */}
        {selectedMatch && (
          <MatchPreviewSheet
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
  headerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
});

export default App;
