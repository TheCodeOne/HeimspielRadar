import type { Match } from '@sundayleague/shared-types';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export const STUTTGART_FALLBACK: LocationCoordinates = {
  latitude: 48.7758,
  longitude: 9.1829,
};

export const DEFAULT_RADIUS_KM = 25;

export function getSampleMatchesMobile(): Match[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  return [
    {
      id: 91001,
      leagueId: 1,
      matchDay: 12,
      kickoffDate: todayStr,
      kickoffTime: '15:30',
      confirmed: true,
      homeTeam: { id: 101, dbbId: 101, name: 'MTV Stuttgart' },
      guestTeam: { id: 102, dbbId: 102, name: 'SV 03 Tübingen' },
      venue: {
        id: 201,
        name: 'Sporthalle West',
        street: 'Bebelstraße 24',
        postalCode: '70193',
        city: 'Stuttgart',
        latitude: 48.7712,
        longitude: 9.1554,
      },
    },
    {
      id: 91002,
      leagueId: 1,
      matchDay: 12,
      kickoffDate: todayStr,
      kickoffTime: '18:00',
      confirmed: true,
      homeTeam: { id: 103, dbbId: 103, name: 'SV Möhringen' },
      guestTeam: { id: 104, dbbId: 104, name: 'TSG Schwäbisch Hall' },
      venue: {
        id: 202,
        name: 'Rembrandthalle',
        street: 'Rembrandtstraße 31',
        postalCode: '70567',
        city: 'Stuttgart',
        latitude: 48.7235,
        longitude: 9.1487,
      },
    },
    {
      id: 91003,
      leagueId: 2,
      matchDay: 10,
      kickoffDate: todayStr,
      kickoffTime: '19:30',
      confirmed: true,
      homeTeam: { id: 105, dbbId: 105, name: 'BBC Stuttgart' },
      guestTeam: { id: 106, dbbId: 106, name: 'VfL Waiblingen' },
      venue: {
        id: 203,
        name: 'Hegel-Gymnasium Halle',
        street: 'Kreuzäckerstraße 48',
        postalCode: '70569',
        city: 'Stuttgart',
        latitude: 48.742,
        longitude: 9.1062,
      },
    },
    {
      id: 91004,
      leagueId: 2,
      matchDay: 10,
      kickoffDate: todayStr,
      kickoffTime: '14:00',
      confirmed: true,
      homeTeam: { id: 107, dbbId: 107, name: 'TV Kornwestheim' },
      guestTeam: { id: 108, dbbId: 108, name: 'BG Remseck' },
      venue: {
        id: 204,
        name: 'Rechberghalle',
        street: 'Brixener Str. 8',
        postalCode: '70806',
        city: 'Kornwestheim',
        latitude: 48.8615,
        longitude: 9.1868,
      },
    },
  ];
}

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

export function formatKickoffTime(timeStr?: string | null): string {
  if (!timeStr || timeStr === '00:00') {
    return 'Uhrzeit offen';
  }

  return `${timeStr} Uhr`;
}
