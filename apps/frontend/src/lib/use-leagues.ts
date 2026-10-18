import * as React from 'react';
import type { League } from '@sundayleague/shared-types';
import { getSampleLeagues } from './sample-matches';

export interface UseLeaguesResult {
  leagues: League[];
  genders: string[];
  ageClasses: string[];
  skillLevels: string[];
  isLoading: boolean;
  error: string | null;
}

function extractDistinctValues(
  leagues: League[],
  selector: (league: League) => string | undefined,
): string[] {
  const values = new Set<string>();

  for (const league of leagues) {
    const rawValue = selector(league)?.trim();

    if (rawValue) {
      values.add(rawValue);
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b, 'de'));
}

export function useLeagues(): UseLeaguesResult {
  const [leagues, setLeagues] = React.useState<League[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const abortController = new AbortController();

    const fetchLeagues = async () => {
      try {
        const res = await fetch('/api/leagues', {
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }

        // SAFETY: The /api/leagues endpoint returns League[] from NestJS MatchesController
        const data = (await res.json()) as League[];

        if (!abortController.signal.aborted) {
          setLeagues(data.length > 0 ? data : getSampleLeagues());
          setIsLoading(false);
        }
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }

        setLeagues(getSampleLeagues());
        setIsLoading(false);

        if (err instanceof Error) {
          setError(err.message);
        }
      }
    };

    void fetchLeagues();

    return () => {
      abortController.abort();
    };
  }, []);

  const genders = React.useMemo(
    () => extractDistinctValues(leagues, (l) => l.geschlecht),
    [leagues],
  );

  const ageClasses = React.useMemo(
    () => extractDistinctValues(leagues, (l) => l.akName),
    [leagues],
  );

  const skillLevels = React.useMemo(
    () => extractDistinctValues(leagues, (l) => l.skName),
    [leagues],
  );

  return {
    leagues,
    genders,
    ageClasses,
    skillLevels,
    isLoading,
    error,
  };
}
