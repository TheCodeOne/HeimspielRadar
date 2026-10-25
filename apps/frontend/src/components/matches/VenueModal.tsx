import * as React from 'react';
import { ExternalLink, MapPin, Trophy, X } from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import {
  compareMatchesChronologically,
  formatDisplayDate,
  formatKickoffTime,
} from '@/lib/date-utils';
import { formatDistance } from '@/lib/geo-utils';
import { formatLeagueName } from '@/components/map/map-utils';
import { getMatchLinks } from '@/lib/match-links';
import { MatchQuickActions } from '@/components/matches/MatchQuickActions';
import { useBottomSheetDrag } from '@/lib/use-bottom-sheet-drag';

export interface VenueModalProps {
  selectedMatch: Match | null;
  venueMatches: Match[];
  onSelectMatch: (matchId: number) => void;
  onClose: () => void;
}

function buildGoogleMapsRouteUrl(match: Match): string {
  return getMatchLinks(match).navigationUrl ?? 'https://www.google.com/maps';
}

export function VenueModal({
  selectedMatch,
  venueMatches,
  onSelectMatch,
  onClose,
}: VenueModalProps) {
  const {
    isAnimatingOut,
    dragY,
    isDragging,
    closeWithAnimation,
    touchHandlers,
  } = useBottomSheetDrag({
    onClose,
  });

  // ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeWithAnimation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeWithAnimation]);

  if (!selectedMatch?.venue) {
    return null;
  }

  const venue = selectedMatch.venue;
  const sortedMatches = [...venueMatches].sort(compareMatchesChronologically);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="venue-modal-title"
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 pointer-events-auto"
    >
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-xs ${
          isAnimatingOut ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
        onClick={closeWithAnimation}
      />

      {/* Modal / Bottom Sheet Card with iOS Spring & Drag Gestures */}
      <div
        style={
          dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                transition: isDragging
                  ? 'none'
                  : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
              }
            : undefined
        }
        className={`relative z-10 flex max-h-[85dvh] md:max-h-[80vh] w-full md:max-w-lg flex-col rounded-t-[28px] md:rounded-2xl border-t md:border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl overflow-hidden ${
          isAnimatingOut ? 'modal-mobile-sheet-out' : 'modal-mobile-sheet-in'
        }`}
      >
        {/* Subtle iOS Grab Handle for Mobile (Touch gesture zone) */}
        <div
          {...touchHandlers}
          className="md:hidden flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-600/70" />
        </div>

        {/* Venue Header */}
        <div
          {...touchHandlers}
          className="flex items-start justify-between gap-3 border-b border-border/60 p-4 sm:p-5 pb-3 bg-card/40 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <h2
                id="venue-modal-title"
                className="truncate text-sm sm:text-base font-bold text-foreground"
              >
                {venue.name}
              </h2>
              {selectedMatch.distanceKm != null && (
                <Badge variant="outline" className="shrink-0 font-mono text-[10px] bg-slate-800/80">
                  {formatDistance(selectedMatch.distanceKm)}
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground pl-9">
              {venue.street}, {venue.postalCode} {venue.city}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={buildGoogleMapsRouteUrl(selectedMatch)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
              title="Route in Google Maps öffnen"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Route</span>
            </a>

            <button
              type="button"
              onClick={closeWithAnimation}
              className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Matches List in this Venue */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 overscroll-contain">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
            <span>
              {sortedMatches.length}{' '}
              {sortedMatches.length === 1
                ? 'Heimspiel in dieser Halle'
                : 'Heimspiele in dieser Halle'}
            </span>
          </div>

          <div className="space-y-2">
            {sortedMatches.map((venueMatch) => {
              const isActiveMatch = venueMatch.id === selectedMatch.id;

              const matchLeagueName = formatLeagueName(
                venueMatch.leagueId,
                venueMatch.league?.name,
              );

              const categoryBadge = [
                venueMatch.league?.akName,
                venueMatch.league?.geschlecht,
              ]
                .filter(Boolean)
                .join(' • ');

              return (
                <div
                  key={venueMatch.id}
                  onClick={() => onSelectMatch(venueMatch.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectMatch(venueMatch.id);
                    }
                  }}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition-all ${
                    isActiveMatch
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40'
                      : 'border-border/60 bg-card/60 hover:border-primary/40 hover:bg-card'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="league" className="text-[10px]">
                        <Trophy className="mr-1 h-2.5 w-2.5" />
                        {matchLeagueName}
                      </Badge>
                      {categoryBadge && (
                        <Badge variant="outline" className="text-[10px] bg-slate-800/60">
                          {categoryBadge}
                        </Badge>
                      )}
                    </div>

                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {formatDisplayDate(venueMatch.kickoffDate)} •{' '}
                      {formatKickoffTime(venueMatch.kickoffTime)}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 text-sm font-bold text-foreground">
                    <span className="truncate">{venueMatch.homeTeam.name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground font-normal">
                      vs.
                    </span>
                    <span className="truncate text-right">
                      {venueMatch.guestTeam.name}
                    </span>
                  </div>

                  {venueMatch.result && (
                    <div className="mt-1.5 text-right font-mono text-xs font-bold text-primary">
                      Endstand: {venueMatch.result}
                    </div>
                  )}

                  <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      DBB Quick-Actions
                    </span>

                    <MatchQuickActions match={venueMatch} size="sm" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="shrink-0 border-t border-border/60 p-3 sm:p-4 bg-slate-950/95">
          <button
            type="button"
            onClick={closeWithAnimation}
            className="w-full rounded-xl bg-slate-800/80 py-2.5 text-xs font-bold text-foreground hover:bg-slate-700 transition"
          >
            Zurück zur Karte
          </button>
        </div>
      </div>
    </div>
  );
}
