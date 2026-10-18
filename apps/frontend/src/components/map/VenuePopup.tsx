import * as React from 'react';
import { Clock, MapPin, Trophy } from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatLeagueName, type VenueGroup } from './map-utils';

export interface VenuePopupProps {
  group: VenueGroup;
  onMarkerClick: (match: Match) => void;
  onClose?: () => void;
}

export function VenuePopup({ group, onMarkerClick, onClose }: VenuePopupProps) {
  const [selectedIdx, setSelectedIdx] = React.useState<number>(0);
  const activeMatch = group.matches[selectedIdx] ?? group.matches[0];

  if (!activeMatch) {
    return null;
  }

  return (
    <div className="w-64 space-y-2 rounded-lg bg-card p-3 text-card-foreground shadow-lg border border-border/80 text-xs">
      <div className="flex items-center justify-between gap-1 border-b border-border/40 pb-2">
        <Badge variant="league" className="text-[10px]">
          <Trophy className="mr-1 h-3 w-3" />
          {formatLeagueName(activeMatch.leagueId, activeMatch.league?.name)}
        </Badge>
        {group.matches.length > 1 && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {selectedIdx + 1}/{group.matches.length} Spiele
          </span>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Schließen"
          >
            ✕
          </button>
        )}
      </div>

      <div className="space-y-1 py-1">
        <div className="flex items-center justify-between font-semibold">
          <span className="truncate">{activeMatch.homeTeam.name}</span>
          <span className="px-1 text-[10px] font-mono text-muted-foreground">vs</span>
          <span className="truncate text-right">{activeMatch.guestTeam.name}</span>
        </div>

        {activeMatch.result && (
          <div className="text-center font-mono font-bold text-primary">
            {activeMatch.result}
          </div>
        )}
      </div>

      <div className="space-y-1 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0 text-primary" />
          <span>
            {activeMatch.kickoffTime} Uhr
            {activeMatch.kickoffDate && ` (${activeMatch.kickoffDate})`}
          </span>
        </div>

        <div className="flex items-start gap-1.5">
          <MapPin className="h-3 w-3 shrink-0 text-primary mt-0.5" />
          <div className="truncate">
            <div className="font-medium text-foreground truncate">{group.venue.name}</div>
            <div className="truncate">
              {group.venue.street}, {group.venue.postalCode} {group.venue.city}
            </div>
          </div>
        </div>
      </div>

      {group.matches.length > 1 && (
        <div className="flex gap-1 pt-1">
          {group.matches.map((m, idx) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`flex-1 rounded py-0.5 text-[10px] font-mono border ${
                idx === selectedIdx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border'
              }`}
            >
              Spiel {idx + 1}
            </button>
          ))}
        </div>
      )}

      <Button
        variant="default"
        size="sm"
        className="w-full text-xs h-7 mt-1"
        onClick={() => onMarkerClick(activeMatch)}
      >
        Spiel auswählen
      </Button>
    </div>
  );
}
