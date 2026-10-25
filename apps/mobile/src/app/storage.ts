import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MobileFilterPreferences,
  DEFAULT_FILTER_PREFERENCES,
  RadiusOption,
  DateFilterOption,
} from './data';

export const MOBILE_FILTER_STORAGE_KEY = 'heimspielradar:mobile_filters:v1';

function isRadiusOption(value: unknown): value is RadiusOption {
  return value === 10 || value === 25 || value === 50;
}

function isDateFilterOption(value: unknown): value is DateFilterOption {
  return (
    value === 'all' ||
    value === 'today' ||
    value === 'tomorrow' ||
    value === 'weekend'
  );
}

export function sanitizeMobileFilters(
  raw: Partial<MobileFilterPreferences> | null | undefined,
): MobileFilterPreferences {
  if (!raw) {
    return { ...DEFAULT_FILTER_PREFERENCES };
  }

  const radiusKm = isRadiusOption(raw.radiusKm)
    ? raw.radiusKm
    : DEFAULT_FILTER_PREFERENCES.radiusKm;

  const dateFilter = isDateFilterOption(raw.dateFilter)
    ? raw.dateFilter
    : DEFAULT_FILTER_PREFERENCES.dateFilter;

  return { radiusKm, dateFilter };
}

export async function loadFilterPreferences(): Promise<MobileFilterPreferences> {
  try {
    const raw = await AsyncStorage.getItem(MOBILE_FILTER_STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_FILTER_PREFERENCES };
    }

    // SAFETY: Parsing stored JSON payload for filter preferences
    const parsed = JSON.parse(raw) as Partial<MobileFilterPreferences>;

    return sanitizeMobileFilters(parsed);
  } catch {
    return { ...DEFAULT_FILTER_PREFERENCES };
  }
}

export async function saveFilterPreferences(
  preferences: MobileFilterPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MOBILE_FILTER_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  } catch {
    // Graceful degradation when storage is unavailable
  }
}
