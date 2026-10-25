import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Match } from '@sundayleague/shared-types';
import type { LocationCoordinates } from './data';

export interface CachedMatchData {
  matches: Match[];
  coords: LocationCoordinates;
  radiusKm: number;
  cachedAt: number; // UNIX epoch ms
}

interface RawCacheEnvelope {
  matches?: unknown;
  coords?: {
    latitude?: unknown;
    longitude?: unknown;
  };
  radiusKm?: unknown;
  cachedAt?: unknown;
}

const STORAGE_KEY = '@heimspielradar/cached_matches_v1';

/**
 * Saves matches, coordinates, and radius to AsyncStorage.
 */
export async function saveCachedMatches(
  matches: Match[],
  coords: LocationCoordinates,
  radiusKm: number,
): Promise<void> {
  try {
    const payload: CachedMatchData = {
      matches,
      coords,
      radiusKm,
      cachedAt: Date.now(),
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to save matches to cache:', error);
  }
}

/**
 * Validates and sanitizes cached match data.
 */
function sanitizeCachedMatches(rawObj: RawCacheEnvelope): CachedMatchData | null {
  if (!Array.isArray(rawObj.matches) || !rawObj.coords) {
    return null;
  }

  const latitude = Number(rawObj.coords.latitude);
  const longitude = Number(rawObj.coords.longitude);
  const radiusKm = Number(rawObj.radiusKm);
  const cachedAt = Number(rawObj.cachedAt);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(radiusKm) ||
    !Number.isFinite(cachedAt)
  ) {
    return null;
  }

  // SAFETY: rawObj.matches was verified as an Array above
  const matches = rawObj.matches as Match[];

  return {
    matches,
    coords: {
      latitude,
      longitude,
    },
    radiusKm,
    cachedAt,
  };
}

/**
 * Retrieves cached match data from AsyncStorage.
 */
export async function getCachedMatches(): Promise<CachedMatchData | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    // SAFETY: JSON.parse parses stored local cache string
    const parsed = JSON.parse(raw) as RawCacheEnvelope;

    if (parsed) {
      return sanitizeCachedMatches(parsed);
    }

    return null;
  } catch (error) {
    console.warn('Failed to load matches from cache:', error);

    return null;
  }
}

/**
 * Clears cached matches.
 */
export async function clearCachedMatches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear matches cache:', error);
  }
}
