import * as React from 'react';
import {
  Frown,
  Loader2,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MatchCard } from './MatchCard';

export interface MatchListProps {
  matches: Match[];
  selectedMatchId?: number | null;
  onSelectMatch: (match: Match) => void;
  onHoverMatch?: (match: Match) => void;
  isLoading?: boolean;
  radiusKm: number;
  onExpandRadius?: () => void;
  onResetFilters?: () => void;
  className?: string;
}

export function MatchList({
  matches,
  selectedMatchId,
  onSelectMatch,
  onHoverMatch,
  isLoading = false,
  radiusKm,
  onExpandRadius,
  onResetFilters,
  className = '',
}: MatchListProps) {
  const cardElementsRef = React.useRef<Map<number, HTMLDivElement>>(new Map());

  // Automatically scroll selected card into view smoothly
  React.useEffect(() => {
    if (selectedMatchId == null) {
      return;
    }

    const element = cardElementsRef.current.get(selectedMatchId);

    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedMatchId]);

  // Loading Skeleton State
  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Suche Heimspiele im Umkreis...</span>
        </div>

        {[1, 2, 3].map((key) => (
          <Card key={key} className="border-border/60 animate-pulse">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between">
                <div className="h-4 w-28 rounded bg-muted" />
                <div className="h-4 w-16 rounded bg-muted" />
              </div>

              <div className="flex items-center justify-between gap-4 py-2">
                <div className="h-6 w-32 rounded bg-muted" />
                <div className="h-4 w-8 rounded bg-muted" />
                <div className="h-6 w-32 rounded bg-muted" />
              </div>

              <div className="h-4 w-48 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty State
  if (matches.length === 0) {
    return (
      <Card className={`border-dashed border-border/80 bg-card/60 p-6 text-center ${className}`}>
        <CardContent className="space-y-4 p-0">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Frown className="h-6 w-6 text-muted-foreground" />
          </div>

          <div className="space-y-1.5">
            <h3 className="font-semibold text-base text-foreground">
              Keine Heimspiele gefunden
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Im Umkreis von {radiusKm} km wurden für die gewählten Filter keine Spiele gefunden.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            {onExpandRadius && radiusKm < 50 && (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onExpandRadius}
                className="w-full sm:w-auto text-xs"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Radius erweitern ({Math.min(50, radiusKm + 15)} km)
              </Button>
            )}

            {onResetFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onResetFilters}
                className="w-full sm:w-auto text-xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {matches.map((match) => {
        const isSelected = selectedMatchId === match.id;

        return (
          <MatchCard
            key={match.id}
            match={match}
            isSelected={isSelected}
            onClick={() => onSelectMatch(match)}
            onMouseEnter={() => onHoverMatch?.(match)}
            ref={(node) => {
              if (node) {
                cardElementsRef.current.set(match.id, node);
              } else {
                cardElementsRef.current.delete(match.id);
              }
            }}
          />
        );
      })}
    </div>
  );
}
