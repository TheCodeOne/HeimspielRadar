export {
  FILTER_STORAGE_KEY,
  type ViewMode,
  type DateFilterMode,
  type DateMode,
  type PersistedFilterState,
  DEFAULT_FILTER_STATE,
  resolveDateRange,
  resolveDateRangeFromMode,
  countActiveFilters,
  sanitizeFilters,
} from './use-match-filters';

import {
  FILTER_STORAGE_KEY,
  DEFAULT_FILTER_STATE,
  type PersistedFilterState,
  type DateFilterMode,
  resolveDateRangeFromMode,
  sanitizeFilters,
  getBerlinDateString,
} from './use-match-filters';

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
    if (typeof window === 'undefined' || !window.localStorage) {
      return DEFAULT_FILTER_STATE;
    }

    const raw = localStorage.getItem(FILTER_STORAGE_KEY);

    if (!raw) {
      return DEFAULT_FILTER_STATE;
    }

    // SAFETY: parse stored JSON payload
    const parsed = JSON.parse(raw);
    const todayStr = getBerlinDateString(new Date());

    return sanitizeFilters(parsed, todayStr);
  } catch {
    return DEFAULT_FILTER_STATE;
  }
}

export function savePersistedFilters(state: PersistedFilterState): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // Ignore storage quota or private mode errors
  }
}
