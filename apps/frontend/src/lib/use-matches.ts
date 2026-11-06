import * as React from 'react';
import {
  calculateDistanceKm,
  evaluateMatchesQuery,
  isTeamNumberMatch,
  sortMatches,
  type Match,
  type NearbyMatchesQuery,
} from '@sundayleague/shared-types';
import { getSampleMatches } from './sample-matches';
import { getBerlinDateString } from './use-match-filters';

export { isTeamNumberMatch, sortMatches };

export { useLeagues, type UseLeaguesResult } from './use-leagues';

export interface UseMatchesOptions {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  lat: number;
  lng: number;
  radiusKm: number;
  leagueId?: number;
  leagueIds?: number[];
  genders?: string[];
  ageClasses?: string[];
  skillLevels?: string[];
  onlyUpcoming?: boolean;
  teamQuery?: string;
  debounceMs?: number;
  initialMasterPool?: MasterPoolState;
}

export interface UseMatchesResult {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const MASTER_POOL_RADIUS_KM = 50;
export const MASTER_POOL_HORIZON_DAYS = 28;

export interface MasterPoolDateRange {
  dateFrom: string;
  dateTo: string;
}

export interface MasterPoolState {
  lat: number;
  lng: number;
  dateFrom: string;
  dateTo: string;
  matches: Match[];
  isLoaded: boolean;
}

export function getMasterPoolDateRange(now: Date = new Date()): MasterPoolDateRange {
  const fromStr = getBerlinDateString(now);
  const toDate = new Date(now.getTime() + MASTER_POOL_HORIZON_DAYS * 24 * 60 * 60 * 1000);
  const toStr = getBerlinDateString(toDate);

  return { dateFrom: fromStr, dateTo: toStr };
}

/**
 * Checks if a user's query can be fulfilled purely in-memory from the loaded masterpool.
 */
export function isQueryCoveredByMasterPool(
  query: UseMatchesOptions,
  pool: MasterPoolState,
): boolean {
  if (!pool.isLoaded) {
    return false;
  }

  if (
    query.lat == null ||
    query.lng == null ||
    isNaN(query.lat) ||
    isNaN(query.lng) ||
    (query.lat === 0 && query.lng === 0) ||
    pool.lat == null ||
    pool.lng == null ||
    isNaN(pool.lat) ||
    isNaN(pool.lng)
  ) {
    return false;
  }

  // Radius limit check: User query radius cannot exceed masterpool radius
  if (query.radiusKm > MASTER_POOL_RADIUS_KM) {
    return false;
  }

  // Distance check: Current query origin shift + requested radius must not exceed masterpool radius
  const originDist = calculateDistanceKm(query.lat, query.lng, pool.lat, pool.lng);

  if (originDist + query.radiusKm > MASTER_POOL_RADIUS_KM) {
    return false;
  }

  // Date range check: Date or range must be bounded and within master pool horizon
  const effectiveDateFrom = query.date || query.dateFrom;
  const effectiveDateTo = query.date || query.dateTo;

  if (!effectiveDateFrom || !effectiveDateTo) {
    return false;
  }

  if (effectiveDateFrom < pool.dateFrom) {
    return false;
  }

  if (effectiveDateTo > pool.dateTo) {
    return false;
  }

  return true;
}

export function filterAndSortMatchesLocally(
  matches: Match[],
  options: UseMatchesOptions,
): Match[] {
  const query: NearbyMatchesQuery = {
    date: options.date,
    dateFrom: options.dateFrom,
    dateTo: options.dateTo,
    lat: options.lat,
    lng: options.lng,
    radiusKm: options.radiusKm,
    leagueId: options.leagueId,
    leagueIds: options.leagueIds,
    genders: options.genders,
    ageClasses: options.ageClasses,
    skillLevels: options.skillLevels,
    onlyUpcoming: options.onlyUpcoming,
    teamQuery: options.teamQuery,
  };

  return evaluateMatchesQuery(matches, query);
}

export function useMatches({
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
  debounceMs = 300,
  initialMasterPool,
}: UseMatchesOptions): UseMatchesResult {
  const [networkMatches, setNetworkMatches] = React.useState<Match[]>([]);
  const [isNetworkLoading, setIsNetworkLoading] = React.useState<boolean>(true);
  const [networkError, setNetworkError] = React.useState<string | null>(null);
  const [triggerCount, setTriggerCount] = React.useState<number>(0);

  // In-memory masterpool state
  const [masterPool, setMasterPool] = React.useState<MasterPoolState>(() =>
    initialMasterPool ?? {
      lat: 0,
      lng: 0,
      dateFrom: '',
      dateTo: '',
      matches: [],
      isLoaded: false,
    },
  );

  const lastMasterPoolFetchRef = React.useRef<{
    lat: number;
    lng: number;
    triggerCount: number;
  }>({ lat: 0, lng: 0, triggerCount: -1 });

  const refetch = React.useCallback(() => {
    setIsNetworkLoading(true);
    setMasterPool((prev) => ({ ...prev, isLoaded: false }));
    setTriggerCount((c) => c + 1);
  }, []);

  const leagueIdsKey = leagueIds?.join(',') ?? '';
  const gendersKey = genders?.join(',') ?? '';
  const ageClassesKey = ageClasses?.join(',') ?? '';
  const skillLevelsKey = skillLevels?.join(',') ?? '';

  const currentOptions: UseMatchesOptions = React.useMemo(
    () => ({
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
    }),
    [
      date,
      dateFrom,
      dateTo,
      lat,
      lng,
      radiusKm,
      leagueId,
      leagueIdsKey,
      gendersKey,
      ageClassesKey,
      skillLevelsKey,
      onlyUpcoming,
      teamQuery,
    ],
  );

  const isCovered = isQueryCoveredByMasterPool(currentOptions, masterPool);

  // Synchronous in-memory evaluation when query is covered by the master pool (0ms latency, no spinner)
  const locallyFilteredMatches = React.useMemo(() => {
    if (!isCovered) {
      return null;
    }

    return filterAndSortMatchesLocally(masterPool.matches, currentOptions);
  }, [isCovered, masterPool.matches, currentOptions]);

  // Background fetch of the masterpool whenever lat/lng are stable or refetch is called
  React.useEffect(() => {
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return;
    }

    const lastFetch = lastMasterPoolFetchRef.current;
    const isSameTrigger = lastFetch.triggerCount === triggerCount;
    const distanceMoved = calculateDistanceKm(lat, lng, lastFetch.lat, lastFetch.lng);

    // Skip re-fetching if we already fetched a pool within 5km for the current trigger count
    if (isSameTrigger && lastFetch.lat !== 0 && distanceMoved < 5) {
      return;
    }

    lastMasterPoolFetchRef.current = { lat, lng, triggerCount };

    const abortController = new AbortController();
    const { dateFrom: poolFrom, dateTo: poolTo } = getMasterPoolDateRange();

    const poolParams = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
      radiusKm: MASTER_POOL_RADIUS_KM.toString(),
      dateFrom: poolFrom,
      dateTo: poolTo,
    });

    fetch(`/api/matches?${poolParams.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          return;
        }

        // SAFETY: The /api/matches endpoint returns an array of Match objects according to OpenAPI/NestJS contract
        const data = (await res.json()) as Match[];

        if (!abortController.signal.aborted) {
          setMasterPool({
            lat,
            lng,
            dateFrom: poolFrom,
            dateTo: poolTo,
            matches: data,
            isLoaded: true,
          });
        }
      })
      .catch(() => {
        // Silently ignore background prefetch errors; fallback handled by active query
      });

    return () => {
      abortController.abort();
    };
  }, [lat, lng, triggerCount]);

  // Network fetch effect for out-of-bounds queries or initial load before pool is available
  React.useEffect(() => {
    if (isCovered) {
      return;
    }

    const abortController = new AbortController();

    setIsNetworkLoading(true);
    setNetworkError(null);

    const timer = setTimeout(async () => {
      try {
        const queryParams = new URLSearchParams();

        if (date) {
          queryParams.set('date', date);
        }

        if (dateFrom) {
          queryParams.set('dateFrom', dateFrom);
        }

        if (dateTo) {
          queryParams.set('dateTo', dateTo);
        }

        queryParams.set('lat', lat.toString());
        queryParams.set('lng', lng.toString());
        queryParams.set('radiusKm', radiusKm.toString());

        if (leagueId) {
          queryParams.set('leagueId', leagueId.toString());
        }

        if (leagueIdsKey) {
          queryParams.set('leagueIds', leagueIdsKey);
        }

        if (gendersKey) {
          queryParams.set('genders', gendersKey);
        }

        if (ageClassesKey) {
          queryParams.set('ageClasses', ageClassesKey);
        }

        if (skillLevelsKey) {
          queryParams.set('skillLevels', skillLevelsKey);
        }

        if (onlyUpcoming) {
          queryParams.set('onlyUpcoming', 'true');
        }

        if (teamQuery) {
          queryParams.set('teamQuery', teamQuery);
        }

        const res = await fetch(`/api/matches?${queryParams.toString()}`, {
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        // SAFETY: The /api/matches endpoint returns an array of Match objects according to OpenAPI/NestJS contract
        const data = (await res.json()) as Match[];
        const localMatches = filterAndSortMatchesLocally(data, currentOptions);

        if (!abortController.signal.aborted) {
          setNetworkMatches(localMatches);
          setIsNetworkLoading(false);
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        // Best effort: If master pool exists, filter from it even if out of bounds
        if (masterPool.isLoaded && masterPool.matches.length > 0) {
          const fallbackMatches = filterAndSortMatchesLocally(
            masterPool.matches,
            currentOptions,
          );

          setNetworkMatches(fallbackMatches);
          setIsNetworkLoading(false);

          return;
        }

        // Ultimate fallback to sample matches
        const fallbackQuery: NearbyMatchesQuery = {
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
        };

        const fallbackResults = evaluateMatchesQuery(
          getSampleMatches(),
          fallbackQuery,
        );

        setNetworkMatches(fallbackResults);
        setIsNetworkLoading(false);

        if (err instanceof Error) {
          setNetworkError(err.message);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [
    isCovered,
    date,
    dateFrom,
    dateTo,
    lat,
    lng,
    radiusKm,
    leagueId,
    leagueIdsKey,
    gendersKey,
    ageClassesKey,
    skillLevelsKey,
    onlyUpcoming,
    teamQuery,
    debounceMs,
    triggerCount,
    masterPool,
    currentOptions,
  ]);

  return {
    matches: isCovered ? (locallyFilteredMatches ?? []) : networkMatches,
    isLoading: isCovered ? false : isNetworkLoading,
    error: isCovered ? null : networkError,
    refetch,
  };
}
