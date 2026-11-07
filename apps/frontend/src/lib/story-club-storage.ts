import { loadPersistedFilters } from './filter-storage';

export const STORY_CLUB_STORAGE_KEY = 'heimspielradar:story-club:v1';

export function getInitialStoryClub(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }

  try {
    const stored = window.localStorage.getItem(STORY_CLUB_STORAGE_KEY);

    if (stored !== null) {
      return stored;
    }

    const fallbackTeam = loadPersistedFilters().teamQuery;

    if (fallbackTeam && fallbackTeam.trim()) {
      return fallbackTeam.trim();
    }
  } catch {
    // Ignore storage read errors
  }

  return '';
}

export function persistStoryClub(club: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(STORY_CLUB_STORAGE_KEY, club);
  } catch {
    // Ignore storage write errors
  }
}
