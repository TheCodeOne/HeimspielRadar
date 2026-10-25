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

export type RadiusOption = 10 | 25 | 50;

export const RADIUS_OPTIONS: RadiusOption[] = [10, 25, 50];

export type DateFilterOption = 'all' | 'today' | 'tomorrow' | 'weekend';

export interface MobileFilterPreferences {
  radiusKm: RadiusOption;
  dateFilter: DateFilterOption;
}

export const DEFAULT_FILTER_PREFERENCES: MobileFilterPreferences = {
  radiusKm: 25,
  dateFilter: 'today',
};

export interface WeekendDates {
  saturdayStr: string;
  sundayStr: string;
}

/**
 * Helper to get ISO date string (YYYY-MM-DD) in Europe/Berlin timezone
 * with an optional day offset relative to now.
 */
export function getBerlinDateString(dayOffset = 0): string {
  const target = new Date();

  if (dayOffset !== 0) {
    target.setDate(target.getDate() + dayOffset);
  }

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(target);
}

/**
 * Calculate Saturday and Sunday ISO date strings for the upcoming / current weekend
 * in Europe/Berlin timezone.
 */
export function getWeekendBerlinDates(): WeekendDates {
  const now = new Date();

  // Get day of week in Europe/Berlin
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    weekday: 'short',
  });

  const weekdayShort = formatter.format(now); // "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"

  const dayOfWeek =
    weekdayShort === 'Sun'
      ? 0
      : weekdayShort === 'Mon'
      ? 1
      : weekdayShort === 'Tue'
      ? 2
      : weekdayShort === 'Wed'
      ? 3
      : weekdayShort === 'Thu'
      ? 4
      : weekdayShort === 'Fri'
      ? 5
      : 6;

  let daysToSaturday = 0;

  if (dayOfWeek === 6) {
    daysToSaturday = 0;
  } else if (dayOfWeek === 0) {
    daysToSaturday = -1; // Saturday was yesterday
  } else {
    daysToSaturday = 6 - dayOfWeek;
  }

  const saturdayStr = getBerlinDateString(daysToSaturday);
  const sundayStr = getBerlinDateString(daysToSaturday + 1);

  return { saturdayStr, sundayStr };
}

export function getSampleMatchesMobile(): Match[] {
  const todayStr = getBerlinDateString(0);
  const tomorrowStr = getBerlinDateString(1);
  const { saturdayStr, sundayStr } = getWeekendBerlinDates();

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
      kickoffDate: tomorrowStr,
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
      kickoffDate: tomorrowStr,
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
    {
      id: 91005,
      leagueId: 1,
      matchDay: 13,
      kickoffDate: saturdayStr,
      kickoffTime: '17:30',
      confirmed: true,
      homeTeam: { id: 109, dbbId: 109, name: 'VfL Waiblingen 1' },
      guestTeam: { id: 110, dbbId: 110, name: 'TSV Künzelsau' },
      venue: {
        id: 205,
        name: 'Rundsporthalle Waiblingen',
        street: 'Beinsteiner Str. 160',
        postalCode: '71334',
        city: 'Waiblingen',
        latitude: 48.8315,
        longitude: 9.3241,
      },
    },
    {
      id: 91006,
      leagueId: 1,
      matchDay: 13,
      kickoffDate: sundayStr,
      kickoffTime: '16:00',
      confirmed: true,
      homeTeam: { id: 111, dbbId: 111, name: 'SV 03 Tübingen' },
      guestTeam: { id: 101, dbbId: 101, name: 'MTV Stuttgart' },
      venue: {
        id: 206,
        name: 'Uhlandhalle Tübingen',
        street: 'Uhlandstraße 28',
        postalCode: '72072',
        city: 'Tübingen',
        latitude: 48.5175,
        longitude: 9.0573,
      },
    },
    {
      id: 91007,
      leagueId: 1,
      matchDay: 14,
      kickoffDate: saturdayStr,
      kickoffTime: '20:00',
      confirmed: true,
      homeTeam: { id: 112, dbbId: 112, name: 'TSG Schwäbisch Hall' },
      guestTeam: { id: 105, dbbId: 105, name: 'BBC Stuttgart' },
      venue: {
        id: 207,
        name: 'Schenckenseehalle',
        street: 'Schenckenseestraße 40',
        postalCode: '74523',
        city: 'Schwäbisch Hall',
        latitude: 49.1065,
        longitude: 9.7423,
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

export function formatKickoffTimeBerlin(
  timeStr?: string | null,
): string {
  if (!timeStr || timeStr === '00:00') {
    return 'Uhrzeit offen';
  }

  return `${timeStr} Uhr`;
}

export const formatKickoffTime = formatKickoffTimeBerlin;
