import {
  getThisWeekendSaturdayString,
  getTodayString,
  getTomorrowString,
} from './date-utils';
import { type LocationReference, STUTTGART_FALLBACK } from './geo-utils';

export const FILTER_STORAGE_KEY = 'heimspielradar:filters:v1';

export type ViewMode = 'map' | 'list';

export type DateMode = 'today' | 'tomorrow' | 'weekend' | 'all' | 'custom';

export interface PersistedFilterState {
  viewMode: ViewMode;
  location: LocationReference;
  radiusKm: number;
  dateMode: DateMode;
  customDate?: string;
  genders: string[];
  ageClasses: string[];
  skillLevels: string[];
  leagueIds: number[];
}

export const DEFAULT_FILTER_STATE: PersistedFilterState = {
  viewMode: 'map',
  location: STUTTGART_FALLBACK,
  radiusKm: 30,
  dateMode: 'today',
  customDate: undefined,
  genders: [],
  ageClasses: [],
  skillLevels: [],
  leagueIds: [],
};

function isViewMode(value?: string): value is ViewMode {
  return value === 'map' || value === 'list';
}

function isDateMode(value?: string): value is DateMode {
  return (
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'weekend' ||
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

export function resolveSelectedDate(
  dateMode: DateMode,
  customDate?: string,
): string {
  switch (dateMode) {
    case 'today':
      return getTodayString();

    case 'tomorrow':
      return getTomorrowString();

    case 'weekend':
      return getThisWeekendSaturdayString();

    case 'all':
      return '';

    case 'custom':
      return customDate || getTodayString();
  }
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

    const location = parseLocation(parsed.location);
    const rawRadius = Number(parsed.radiusKm);

    const radiusKm =
      Number.isFinite(rawRadius) && rawRadius >= 5 && rawRadius <= 50
        ? rawRadius
        : DEFAULT_FILTER_STATE.radiusKm;

    let dateMode = isDateMode(parsed.dateMode)
      ? parsed.dateMode
      : DEFAULT_FILTER_STATE.dateMode;

    let customDate =
      parsed.customDate && String(parsed.customDate).length > 0
        ? String(parsed.customDate)
        : undefined;

    const todayStr = getTodayString();

    // Smart Date Restoration: if customDate is missing or in the past, fall back to 'today'
    if (dateMode === 'custom' && (!customDate || customDate < todayStr)) {
      dateMode = 'today';
      customDate = undefined;
    }

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
      location,
      radiusKm,
      dateMode,
      customDate,
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
