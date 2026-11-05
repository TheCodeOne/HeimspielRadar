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

export { isTeamNumberMatch };

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
}

export interface UseMatchesResult {
  matches: Match[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
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
}: UseMatchesOptions): UseMatchesResult {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [triggerCount, setTriggerCount] = React.useState<number>(0);

  const refetch = React.useCallback(() => {
    setTriggerCount((c) => c + 1);
  }, []);

  const leagueIdsKey = leagueIds?.join(',') ?? '';
  const gendersKey = genders?.join(',') ?? '';
  const ageClassesKey = ageClasses?.join(',') ?? '';
  const skillLevelsKey = skillLevels?.join(',') ?? '';

  React.useEffect(() => {
    const abortController = new AbortController();
    setIsLoading(true);
    setError(null);

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

        // SAFETY: The /api/matches endpoint returns Match[] from NestJS MatchesService
        const data = (await res.json()) as Match[];

        // Recompute distances relative to current reference point if missing
        const processed: Match[] = [];

        for (const item of data) {
          let distance = item.distanceKm;

          if (
            distance == null &&
            item.venue?.latitude != null &&
            item.venue?.longitude != null
          ) {
            distance = calculateDistanceKm(
              lat,
              lng,
              item.venue.latitude,
              item.venue.longitude,
            );
          }

          processed.push({
            ...item,
            distanceKm: distance,
          });
        }

        const sorted = sortMatches(processed, { teamQuery });

        if (!abortController.signal.aborted) {
          setMatches(sorted);
          setIsLoading(false);
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        // Fallback to sample matches evaluated by shared domain specification
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

        setMatches(fallbackResults);
        setIsLoading(false);

        if (err instanceof Error) {
          setError(err.message);
        }
      }
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [
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
  ]);

  return {
    matches,
    isLoading,
    error,
    refetch,
  };
}
