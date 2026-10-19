import type { MapEngineType } from '@/components/map/map-engine.types';
import {
  type DateRange,
  getTodayString,
  getTomorrowString,
  getWeekendRange,
} from './date-utils';
import { type LocationReference, STUTTGART_FALLBACK } from './geo-utils';

export const FILTER_STORAGE_KEY = 'heimspielradar:filters:v1';

export type ViewMode = 'map' | 'list';

export type DateFilterMode =
  | 'today'
  | 'tomorrow'
  | 'weekend'
  | 'next-weekend'
  | 'weekend-after-next'
  | 'all'
  | 'custom';

export type DateMode = DateFilterMode;

export interface PersistedFilterState {
  viewMode: ViewMode;
  mapEngine: MapEngineType;
  location: LocationReference;
  radiusKm: number;
  showRadiusCircle: boolean;
  dateMode: DateFilterMode;
  customDate?: string;
  customDateFrom: string;
  customDateTo: string;
  onlyUpcoming: boolean;
  genders: string[];
  ageClasses: string[];
  skillLevels: string[];
  leagueIds: number[];
}

export const DEFAULT_FILTER_STATE: PersistedFilterState = {
  viewMode: 'map',
  mapEngine: 'openlayers',
  location: STUTTGART_FALLBACK,
  radiusKm: 30,
  showRadiusCircle: true,
  dateMode: 'today',
  customDate: undefined,
  customDateFrom: '',
  customDateTo: '',
  onlyUpcoming: true,
  genders: [],
  ageClasses: [],
  skillLevels: [],
  leagueIds: [],
};

function isViewMode(value?: string): value is ViewMode {
  return value === 'map' || value === 'list';
}

function isMapEngine(value?: string): value is MapEngineType {
  return (
    value === 'openlayers' ||
    value === 'maplibre' ||
    value === 'leaflet' ||
    value === 'pigeon'
  );
}

function isDateMode(value?: string): value is DateFilterMode {
  return (
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'weekend' ||
    value === 'next-weekend' ||
    value === 'weekend-after-next' ||
    value === 'all' ||
    value === 'custom'
  );
}

function parseLocation(loc?: Partial<LocationReference>): LocationReference {
  if (!loc) {
    return DEFAULT_FILTER_STATE.location;
  }

  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  const name = loc.name ? String(loc.name) : '';

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name) {
    return DEFAULT_FILTER_STATE.location;
  }

  return { lat, lng, name };
}

export function resolveDateRangeFromMode(
  mode: DateFilterMode,
  customDateFrom: string,
  customDateTo: string,
): DateRange {
  switch (mode) {
    case 'today': {
      const today = getTodayString();

      return { dateFrom: today, dateTo: today };
    }

    case 'tomorrow': {
      const tomorrow = getTomorrowString();

      return { dateFrom: tomorrow, dateTo: tomorrow };
    }

    case 'weekend':
      return getWeekendRange(0);

    case 'next-weekend':
      return getWeekendRange(1);

    case 'weekend-after-next':
      return getWeekendRange(2);

    case 'all':
      return { dateFrom: '', dateTo: '' };

    case 'custom':
      return {
        dateFrom: customDateFrom,
        dateTo: customDateTo,
      };
  }
}

export function resolveSelectedDate(
  dateMode: DateFilterMode,
  customDate?: string,
): string {
  const range = resolveDateRangeFromMode(
    dateMode,
    customDate ?? '',
    customDate ?? '',
  );

  return range.dateFrom;
}

export function loadPersistedFilters(): PersistedFilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_FILTER_STATE;
    }

    // SAFETY: localStorage JSON is parsed as a partial filter state and sanitized below
    const parsed = JSON.parse(raw) as Partial<PersistedFilterState>;

    if (!parsed) {
      return DEFAULT_FILTER_STATE;
    }

    const viewMode = isViewMode(parsed.viewMode)
      ? parsed.viewMode
      : DEFAULT_FILTER_STATE.viewMode;

    const mapEngine = isMapEngine(parsed.mapEngine)
      ? parsed.mapEngine
      : DEFAULT_FILTER_STATE.mapEngine;

    const location = parseLocation(parsed.location);
    const rawRadius = Number(parsed.radiusKm);

    const radiusKm =
      Number.isFinite(rawRadius) && rawRadius >= 5 && rawRadius <= 50
        ? rawRadius
        : DEFAULT_FILTER_STATE.radiusKm;

    let dateMode = isDateMode(parsed.dateMode)
      ? parsed.dateMode
      : DEFAULT_FILTER_STATE.dateMode;

    const legacyCustomDate =
      parsed.customDate && String(parsed.customDate).length > 0
        ? String(parsed.customDate)
        : '';

    let customDateFrom =
      parsed.customDateFrom && String(parsed.customDateFrom).length > 0
        ? String(parsed.customDateFrom)
        : legacyCustomDate;

    let customDateTo =
      parsed.customDateTo && String(parsed.customDateTo).length > 0
        ? String(parsed.customDateTo)
        : legacyCustomDate;

    const todayStr = getTodayString();

    // Smart Date Restoration: if custom range is completely in the past or empty, fall back to 'today'
    if (dateMode === 'custom') {
      const effectiveEnd = customDateTo || customDateFrom;

      if (!effectiveEnd || effectiveEnd < todayStr) {
        dateMode = 'today';
        customDateFrom = '';
        customDateTo = '';
      }
    }

    const onlyUpcoming =
      parsed.onlyUpcoming === true || parsed.onlyUpcoming === false
        ? parsed.onlyUpcoming
        : DEFAULT_FILTER_STATE.onlyUpcoming;

    const showRadiusCircle =
      parsed.showRadiusCircle === true || parsed.showRadiusCircle === false
        ? parsed.showRadiusCircle
        : DEFAULT_FILTER_STATE.showRadiusCircle;

    const genders = Array.isArray(parsed.genders)
      ? parsed.genders.map((item) => String(item)).filter(Boolean)
      : [];

    const ageClasses = Array.isArray(parsed.ageClasses)
      ? parsed.ageClasses.map((item) => String(item)).filter(Boolean)
      : [];

    const skillLevels = Array.isArray(parsed.skillLevels)
      ? parsed.skillLevels.map((item) => String(item)).filter(Boolean)
      : [];

    const leagueIds = Array.isArray(parsed.leagueIds)
      ? parsed.leagueIds
          .map((item) => Number(item))
          .filter((num) => Number.isFinite(num))
      : [];

    return {
      viewMode,
      mapEngine,
      location,
      radiusKm,
      showRadiusCircle,
      dateMode,
      customDate: customDateFrom || undefined,
      customDateFrom,
      customDateTo,
      onlyUpcoming,
      genders,
      ageClasses,
      skillLevels,
      leagueIds,
    };
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}

export function savePersistedFilters(state: PersistedFilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private mode errors
  }
}

export function countActiveFilters(state: PersistedFilterState): number {
  let count = 0;

  if (state.radiusKm !== DEFAULT_FILTER_STATE.radiusKm) {
    count += 1;
  }

  if (state.dateMode !== 'today') {
    count += 1;
  }

  if (state.onlyUpcoming !== DEFAULT_FILTER_STATE.onlyUpcoming) {
    count += 1;
  }

  if (state.genders.length > 0) {
    count += 1;
  }

  if (state.ageClasses.length > 0) {
    count += 1;
  }

  if (state.skillLevels.length > 0) {
    count += 1;
  }

  if (state.leagueIds.length > 0) {
    count += 1;
  }

  return count;
}
