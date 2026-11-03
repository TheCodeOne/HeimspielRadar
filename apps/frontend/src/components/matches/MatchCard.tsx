import * as React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Trophy,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { formatLeagueName } from '@/components/map/map-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { formatDistance } from '@/lib/geo-utils';
import { MatchQuickActions } from './MatchQuickActions';

export interface MatchCardProps {
  match: Match;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  className?: string;
}

export const MatchCard = React.forwardRef<HTMLDivElement, MatchCardProps>(
  ({ match, isSelected = false, onClick, onMouseEnter, className = '' }, ref) => {
    const isFinished = Boolean(match.result);
    const isFeatured = Boolean(match.isFeatured);
    const leagueName = formatLeagueName(match.leagueId, match.league?.name);
    const dateFormatted = formatDisplayDate(match.kickoffDate);
    const categoryParts = [match.league?.akName, match.league?.geschlecht].filter(Boolean);
    const kioskTeaser = match.venue?.kioskDescription ?? match.matchNotes;

    const cardStateClasses = isSelected
      ? 'border-primary ring-2 ring-primary/40 bg-accent/25 shadow-md -translate-y-0.5'
      : isFeatured
        ? 'border-amber-500/80 ring-1 ring-amber-500/40 bg-linear-to-br from-amber-500/10 via-card to-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:border-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]'
        : 'border-border/70 hover:border-primary/50 hover:bg-muted/20 hover:shadow-xs';

    return (
      <Card
        ref={ref}
        data-match-id={match.id}
        data-featured={isFeatured ? 'true' : undefined}
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={`cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${cardStateClasses} ${className}`}
      >
        <CardHeader className="pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {isFeatured && (
                <Badge
                  variant="featured"
                  data-testid="featured-match-badge"
                  className="text-[11px]"
                >
                  <span className="mr-1" aria-hidden="true">
                    ⭐
                  </span>
                  Spiel des Tages / Derby-Tipp
                </Badge>
              )}

              <Badge variant="league" className="text-[11px]">
                <Trophy className="mr-1 h-3 w-3" />
                {leagueName}
              </Badge>

              {categoryParts.length > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  {categoryParts.join(' • ')}
                </Badge>
              )}

              <Badge variant="kickoff" className="text-[11px]">
                <Clock className="mr-1 h-3 w-3" />
                {formatKickoffTime(match.kickoffTime)}
              </Badge>

              <span className="font-mono text-[11px] text-muted-foreground">
                {match.matchDay}. Spieltag
              </span>
            </div>


            {/* Score Badge if finished or Confirmation Status Badge */}
            {isFinished ? (
              <Badge variant="secondary" className="font-mono font-bold text-primary text-xs">
                {match.result} {match.confirmed ? '(bestätigt)' : '(vorläufig)'}
              </Badge>
            ) : match.confirmed ? (
              <Badge variant="success" className="text-[11px]">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Bestätigt
              </Badge>
            ) : (
              <Badge variant="warning" className="text-[11px]">
                Vorläufig
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pb-3">
          {/* Teams Matchup */}
          <div className="flex items-center justify-between gap-3 py-1.5">
            <div className="flex-1 space-y-0.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Heim
              </span>
              <div className="font-bold text-base text-foreground leading-tight">
                {match.homeTeam.name}
              </div>
            </div>

            <div className="shrink-0 px-2.5 py-1 text-xs font-mono font-semibold text-muted-foreground rounded-md bg-muted/80">
              VS
            </div>

            <div className="flex-1 space-y-0.5 text-right">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Gast
              </span>
              <div className="font-bold text-base text-foreground leading-tight">
                {match.guestTeam.name}
              </div>
            </div>
          </div>

          {/* Venue & Distance Information */}
          {match.venue && (
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground">
                  {match.venue.name}
                </span>
                <span className="truncate text-muted-foreground">
                  • {match.venue.city}
                </span>
              </div>

              <span className="shrink-0 font-mono text-[11px] font-medium text-primary">
                {formatDistance(match.distanceKm)}
              </span>
            </div>
          )}

          {kioskTeaser && (
            <div
              data-testid="match-kiosk-teaser"
              className="mt-2 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200"
            >
              <span className="shrink-0 text-sm leading-none" aria-hidden="true">
                🥨
              </span>
              <span className="truncate font-medium">{kioskTeaser}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-2 pb-2.5 flex flex-col gap-2 border-t border-border/30 mt-1">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>{dateFormatted}</span>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
              className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              <Compass className="mr-1 h-3 w-3" />
              Auf Karte anzeigen
            </Button>
          </div>

          <div className="w-full border-t border-border/20 pt-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              DBB Quick-Actions
            </span>

            <MatchQuickActions match={match} />
          </div>
        </CardFooter>
      </Card>
    );
  },
);

MatchCard.displayName = 'MatchCard';
