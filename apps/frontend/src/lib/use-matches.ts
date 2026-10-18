import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { getTodayString } from './date-utils';
import { calculateDistanceKm } from './geo-utils';
import { getSampleMatches } from './sample-matches';

export { useLeagues, type UseLeaguesResult } from './use-leagues';

export interface UseMatchesOptions {
  date?: string;
  lat: number;
  lng: number;
  radiusKm: number;
  leagueId?: number;
  leagueIds?: number[];
  genders?: string[];
  ageClasses?: string[];
  skillLevels?: string[];
  onlyUpcoming?: boolean;
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
  lat,
  lng,
  radiusKm,
  leagueId,
  leagueIds,
  genders,
  ageClasses,
  skillLevels,
  onlyUpcoming,
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

        processed.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

        if (!abortController.signal.aborted) {
          setMatches(processed);
          setIsLoading(false);
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        // Fallback to sample matches with local spatial, date, and league filtering
        const samplePool = getSampleMatches();
        const fallbackResults: Match[] = [];
        const todayStr = getTodayString();

        for (const sample of samplePool) {
          let dist = sample.distanceKm;

          if (sample.venue?.latitude != null && sample.venue?.longitude != null) {
            dist = calculateDistanceKm(
              lat,
              lng,
              sample.venue.latitude,
              sample.venue.longitude,
            );
          }

          // Apply date filter if selected
          if (date && sample.kickoffDate !== date) {
            continue;
          }

          // Apply upcoming & no-result filter if selected
          if (onlyUpcoming) {
            const hasResult =
              sample.result != null && sample.result.trim().length > 0;

            if (hasResult || !sample.kickoffDate || sample.kickoffDate < todayStr) {
              continue;
            }
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

          // Apply radius filter
          if (dist != null && dist > radiusKm) {
            continue;
          }

          fallbackResults.push({
            ...sample,
            distanceKm: dist,
          });
        }

        fallbackResults.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));

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
    lat,
    lng,
    radiusKm,
    leagueId,
    leagueIdsKey,
    gendersKey,
    ageClassesKey,
    skillLevelsKey,
    onlyUpcoming,
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

