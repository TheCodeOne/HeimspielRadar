import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import { getSampleMatches } from '@/lib/sample-matches';
import { StoryEditorView } from './StoryEditorView';

export interface StoryMatchRouteContainerProps {
  matchId: number;
  onBack: () => void;
  onShareFeedback?: (message: string) => void;
}

export function StoryMatchRouteContainer({
  matchId,
  onBack,
  onShareFeedback,
}: StoryMatchRouteContainerProps) {
  const [match, setMatch] = React.useState<Match | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    async function loadMatch() {
      try {
        const res = await fetch(`/api/matches/${matchId}`);

        if (res.ok) {
          // SAFETY: Backend /api/matches/:id returns domain Match DTO
          const data = (await res.json()) as Match;

          if (!isCancelled) {
            setMatch(data);
            setIsLoading(false);
          }

          return;
        }
      } catch {
        // Fall back to sample data
      }

      if (!isCancelled) {
        const sample = getSampleMatches().find((m) => m.id === matchId) ?? null;
        setMatch(sample);
        setIsLoading(false);
      }
    }

    loadMatch();

    return () => {
      isCancelled = true;
    };
  }, [matchId]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 h-dvh w-full flex flex-col items-center justify-center bg-background text-foreground">
        <div className="h-9 w-9 border-2 border-primary border-t-transparent animate-spin rounded-full mb-3" />
        <p className="text-sm text-muted-foreground">Lade Spieldaten für Story...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fixed inset-0 h-dvh w-full flex flex-col items-center justify-center bg-background px-4 text-center text-foreground">
        <h1 className="text-3xl font-extrabold tracking-tight">Spiel nicht gefunden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Das angeforderte Spiel existiert nicht oder wurde verschoben.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
        >
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  return (
    <StoryEditorView
      match={match}
      onBack={onBack}
      onShareFeedback={onShareFeedback}
    />
  );
}
