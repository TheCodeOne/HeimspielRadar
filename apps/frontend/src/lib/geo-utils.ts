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

/**
 * Haversine formula to calculate the distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

/**
 * Formats distance with unit suffix.
 */
export function formatDistance(distanceKm?: number): string {
  if (distanceKm == null) {
    return '-- km';
  }

  return `${distanceKm.toFixed(1)} km entfernt`;
}
