import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { calculateDistanceKm } from './geo-utils';
import { getSampleMatches } from './sample-matches';

export interface UseMatchesOptions {
  date?: string;
  lat: number;
  lng: number;
  radiusKm: number;
  leagueId?: number;
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
  debounceMs = 300,
}: UseMatchesOptions): UseMatchesResult {
  const [matches, setMatches] = React.useState<Match[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [triggerCount, setTriggerCount] = React.useState<number>(0);

  const refetch = React.useCallback(() => {
    setTriggerCount((c) => c + 1);
  }, []);

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

        // Fallback to sample matches with local spatial and date filtering
        const samplePool = getSampleMatches();
        const fallbackResults: Match[] = [];

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

          // Apply league filter if selected
          if (leagueId && sample.leagueId !== leagueId) {
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
  }, [date, lat, lng, radiusKm, leagueId, debounceMs, triggerCount]);

  return {
    matches,
    isLoading,
    error,
    refetch,
  };
}
