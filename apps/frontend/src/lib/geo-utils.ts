/**
 * Geographic utility functions for proximity calculation and location fallback.
 */

export interface LocationReference {
  lat: number;
  lng: number;
  name: string;
}

/**
 * Fallback location: Stuttgart city center coordinates.
 */
export const STUTTGART_FALLBACK: LocationReference = {
  lat: 48.7758,
  lng: 9.1829,
  name: 'Stuttgart',
};

export { calculateDistanceKm } from '@sundayleague/shared-types';

/**
 * Formats distance with unit suffix.
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm == null) {
    return '-- km';
  }

  return `${distanceKm.toFixed(1)} km entfernt`;
}
