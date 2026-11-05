import type { Match, NearbyMatchesQuery } from './basketball.types';

export interface UpcomingCutoff {
  cutoffDateStr: string;
  cutoffTimeStr: string;
}

export interface UpcomingMatchCandidate {
  kickoffDate?: string | null;
  kickoffTime?: string | null;
  result?: string | null;
}

export interface ChronologicalMatchItem {
  id: number;
  kickoffDate?: string | null;
  kickoffTime?: string | null;
}

export interface SortMatchesOptions {
  teamQuery?: string;
}

/**
 * Returns the Europe/Berlin cutoff date and time (2 hours prior to nowMs).
 * DBB matches are scheduled in Europe/Berlin local time.
 */
export function getUpcomingCutoffBerlin(nowMs = Date.now()): UpcomingCutoff {
  const cutoff = new Date(nowMs - 2 * 60 * 60 * 1000);

  const berlinParts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(cutoff);

  const [cutoffDateStr = '', cutoffTimeStr = '00:00'] = berlinParts.split(' ');

  return { cutoffDateStr, cutoffTimeStr };
}

/**
 * Checks whether a match is upcoming according to the 2-hour Europe/Berlin live cutoff window.
 * Completed matches (having non-empty results) and unscheduled matches without kickoffDate return false.
 * Matches with kickoffTime '00:00' or missing on the cutoff date are treated as unscheduled game day entries.
 */
export function isMatchUpcoming(
  match: UpcomingMatchCandidate,
  cutoff: UpcomingCutoff = getUpcomingCutoffBerlin(),
): boolean {
  const hasResult = match.result != null && match.result.trim().length > 0;

  if (hasResult || !match.kickoffDate) {
    return false;
  }

  if (match.kickoffDate > cutoff.cutoffDateStr) {
    return true;
  }

  if (match.kickoffDate < cutoff.cutoffDateStr) {
    return false;
  }

  const time = match.kickoffTime?.trim() || '';

  if (!time || time === '00:00') {
    return true;
  }

  return time > cutoff.cutoffTimeStr;
}

/**
 * Haversine formula to compute great-circle distance between two geographic coordinates in kilometers.
 * Rounded to 1 decimal place.
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

export const calculateHaversineDistanceKm = calculateDistanceKm;

/**
 * Compares two matches chronologically by kickoffDate ascending (null/empty last),
 * then kickoffTime ascending (null/empty/'00:00' last), then id ascending.
 */
export function compareMatchesChronologically(
  a: ChronologicalMatchItem,
  b: ChronologicalMatchItem,
): number {
  const dateA = a.kickoffDate?.trim() || '';
  const dateB = b.kickoffDate?.trim() || '';

  if (dateA !== dateB) {
    if (!dateA) {
      return 1;
    }

    if (!dateB) {
      return -1;
    }

    return dateA.localeCompare(dateB);
  }

  const rawTimeA = a.kickoffTime?.trim() || '';
  const rawTimeB = b.kickoffTime?.trim() || '';
  const timeA = rawTimeA === '00:00' ? '' : rawTimeA;
  const timeB = rawTimeB === '00:00' ? '' : rawTimeB;

  if (timeA !== timeB) {
    if (!timeA) {
      return 1;
    }

    if (!timeB) {
      return -1;
    }

    return timeA.localeCompare(timeB);
  }

  return a.id - b.id;
}

/**
 * Disambiguates team number queries (e.g. distinguishing first teams from reserve teams like Team 2).
 */
export function isTeamNumberMatch(
  teamName: string,
  shortName: string | null | undefined,
  queryNum: number | undefined,
  _queryBase: string,
  rawQuery: string,
): boolean {
  const tTrim = teamName.trim();
  const m = tTrim.match(/^(.*?)(?:\s+(\d+)|\s*\((\d+)\))$/);
  const tBase = (m ? m[1] : tTrim).trim().toLowerCase();
  const tNum = m ? parseInt(m[2] ?? m[3], 10) : 1;
  const sLower = shortName?.trim().toLowerCase() ?? '';

  if (queryNum !== undefined) {
    return tNum === queryNum;
  }

  // queryNum is undefined: if candidate is a reserve team (>= 2), check if query targets its base
  if (tNum >= 2) {
    const rawLower = rawQuery.trim().toLowerCase();

    if (rawLower.includes(tBase) || (sLower && rawLower.includes(sLower))) {
      return false;
    }
  }

  return true;
}

/**
 * Sorts matches:
 * 1. Featured matches first.
 * 2. If teamQuery is active: chronologically.
 * 3. Otherwise: distance ascending, then chronologically.
 */
export function sortMatches(
  matches: Match[],
  options?: SortMatchesOptions,
): Match[] {
  return [...matches].sort((a, b) => {
    const aFeatured = a.isFeatured ? 1 : 0;
    const bFeatured = b.isFeatured ? 1 : 0;

    if (aFeatured !== bFeatured) {
      return bFeatured - aFeatured;
    }

    if (options?.teamQuery) {
      return compareMatchesChronologically(a, b);
    }

    const distDiff = (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);

    if (distDiff !== 0) {
      return distDiff;
    }

    return compareMatchesChronologically(a, b);
  });
}

/**
 * Pure domain specification evaluator that evaluates a NearbyMatchesQuery against
 * an in-memory list of matches with full filter and sorting parity.
 */
export function evaluateMatchesQuery(
  matches: Match[],
  query: NearbyMatchesQuery,
  nowMs = Date.now(),
): Match[] {
  const {
    date,
    dateFrom,
    dateTo,
    lat,
    lng,
    radiusKm,
    leagueId,
    leagueIds,
    genders,
    ageClasses,
    skillLevels,
    onlyUpcoming,
    teamQuery,
  } = query;

  const cutoff = onlyUpcoming ? getUpcomingCutoffBerlin(nowMs) : undefined;

  const hasSpatialCoords =
    lat !== undefined &&
    lat !== null &&
    lng !== undefined &&
    lng !== null &&
    !isNaN(lat) &&
    !isNaN(lng);

  const filteredResults: Match[] = [];

  for (const sample of matches) {
    let dist = sample.distanceKm;

    if (
      hasSpatialCoords &&
      sample.venue?.latitude != null &&
      sample.venue?.longitude != null
    ) {
      dist = calculateDistanceKm(
        lat,
        lng,
        sample.venue.latitude,
        sample.venue.longitude,
      );
    }

    // Apply exact date filter if selected
    if (date && sample.kickoffDate !== date) {
      continue;
    }

    // Apply date range start filter if selected
    if (dateFrom && (!sample.kickoffDate || sample.kickoffDate < dateFrom)) {
      continue;
    }

    // Apply date range end filter if selected
    if (dateTo && (!sample.kickoffDate || sample.kickoffDate > dateTo)) {
      continue;
    }

    // Apply upcoming & no-result 2-hour cutoff filter if selected
    if (onlyUpcoming && !isMatchUpcoming(sample, cutoff)) {
      continue;
    }

    // Apply single league filter if selected
    if (leagueId && sample.leagueId !== leagueId) {
      continue;
    }

    // Apply multi-league filter if selected
    if (leagueIds && leagueIds.length > 0 && !leagueIds.includes(sample.leagueId)) {
      continue;
    }

    // Apply gender filter if selected
    if (
      genders &&
      genders.length > 0 &&
      (!sample.league?.geschlecht ||
        !genders.some(
          (g) => g.toLowerCase() === sample.league?.geschlecht?.toLowerCase(),
        ))
    ) {
      continue;
    }

    // Apply ageClass filter if selected
    if (
      ageClasses &&
      ageClasses.length > 0 &&
      (!sample.league?.akName || !ageClasses.includes(sample.league.akName))
    ) {
      continue;
    }

    // Apply skillLevel filter if selected
    if (
      skillLevels &&
      skillLevels.length > 0 &&
      (!sample.league?.skName || !skillLevels.includes(sample.league.skName))
    ) {
      continue;
    }

    // Apply teamQuery filter if selected (supports multi-token queries like "MTV Stuttgart U12" and disambiguates reserve teams)
    if (teamQuery) {
      const trimmedQuery = teamQuery.trim();
      const numMatch = trimmedQuery.match(/^(.*?)(?:\s+(\d+)|\s*\((\d+)\))$/);
      const queryNum = numMatch ? parseInt(numMatch[2] ?? numMatch[3], 10) : undefined;
      const queryBase = (numMatch ? numMatch[1] : trimmedQuery).trim();
      const searchPhrase = queryNum !== undefined ? queryBase : trimmedQuery;

      const isHomeValid = isTeamNumberMatch(
        sample.homeTeam.name,
        sample.homeTeam.shortName,
        queryNum,
        queryBase,
        trimmedQuery,
      );

      const isGuestValid = isTeamNumberMatch(
        sample.guestTeam.name,
        sample.guestTeam.shortName,
        queryNum,
        queryBase,
        trimmedQuery,
      );

      const qLower = searchPhrase.toLowerCase();

      const homePhraseMatches =
        isHomeValid &&
        (sample.homeTeam.name.toLowerCase().includes(qLower) ||
          Boolean(sample.homeTeam.shortName?.toLowerCase().includes(qLower)));

      const guestPhraseMatches =
        isGuestValid &&
        (sample.guestTeam.name.toLowerCase().includes(qLower) ||
          Boolean(sample.guestTeam.shortName?.toLowerCase().includes(qLower)));

      const tokens = qLower.split(/\s+/).filter(Boolean);

      const multiTokenMatches =
        tokens.length > 1 &&
        tokens.every((tok) => {
          const homeMatches =
            isHomeValid &&
            (sample.homeTeam.name.toLowerCase().includes(tok) ||
              Boolean(sample.homeTeam.shortName?.toLowerCase().includes(tok)));

          const guestMatches =
            isGuestValid &&
            (sample.guestTeam.name.toLowerCase().includes(tok) ||
              Boolean(sample.guestTeam.shortName?.toLowerCase().includes(tok)));

          const leagueMatches =
            Boolean(sample.league?.akName?.toLowerCase().includes(tok)) ||
            Boolean(sample.league?.geschlecht?.toLowerCase().includes(tok));

          return homeMatches || guestMatches || leagueMatches;
        });

      if (!homePhraseMatches && !guestPhraseMatches && !multiTokenMatches) {
        continue;
      }
    }

    // Apply radius filter (bypassed when searching globally by team)
    if (!teamQuery && dist != null && radiusKm != null && dist > radiusKm) {
      continue;
    }

    filteredResults.push({
      ...sample,
      distanceKm: dist,
    });
  }

  return sortMatches(filteredResults, { teamQuery });
}
