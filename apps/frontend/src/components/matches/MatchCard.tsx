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
import { useKioskQueue } from '@/lib/kiosk-submission-queue';
import { KioskInfoBadges } from './KioskInfoBadges';
import { KioskSubmissionModal } from './KioskSubmissionModal';
import { MatchQuickActions } from './MatchQuickActions';
import { TopMatchInfoModal } from './TopMatchInfoModal';

export interface MatchCardProps {
  match: Match;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onReportKioskInfo?: (match: Match) => void;
  className?: string;
}

export const MatchCard = React.forwardRef<HTMLDivElement, MatchCardProps>(
  (
    {
      match,
      isSelected = false,
      onClick,
      onMouseEnter,
      onReportKioskInfo,
      className = '',
    },
    ref,
  ) => {
    const [isLocalModalOpen, setIsLocalModalOpen] = React.useState(false);
    const [isTopMatchModalOpen, setIsTopMatchModalOpen] = React.useState(false);
    const [localToast, setLocalToast] = React.useState<string | null>(null);

    const { hasPendingSubmission } = useKioskQueue();
    const hasPendingOffline = hasPendingSubmission(match.id);

    const isFinished = Boolean(match.result);
    const isFeatured = Boolean(match.isFeatured);
    const leagueName = formatLeagueName(match.leagueId, match.league?.name);
    const dateFormatted = formatDisplayDate(match.kickoffDate);
    const categoryParts = [match.league?.akName, match.league?.geschlecht].filter(Boolean);
    const effectiveKiosk = match.kioskDescription ?? match.venue?.kioskDescription;
    const effectiveParking = match.parkingNotes ?? match.venue?.parkingNotes;
    const kioskTeaser = effectiveKiosk ?? match.matchNotes;

    const cardStateClasses = isSelected
      ? 'border-primary ring-2 ring-primary/40 bg-accent/25 shadow-md -translate-y-0.5'
      : isFeatured
        ? 'border-amber-500/80 ring-1 ring-amber-500/40 bg-linear-to-br from-amber-500/10 via-card to-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.18)] hover:border-amber-400 hover:shadow-[0_0_24px_rgba(245,158,11,0.28)]'
        : 'border-border/70 hover:border-primary/50 hover:bg-muted/20 hover:shadow-xs';

    const hasKioskOrVenueInfo = Boolean(
      isFeatured ||
        match.admissionFee?.trim() ||
        effectiveKiosk?.trim() ||
        effectiveParking?.trim() ||
        match.matchNotes?.trim() ||
        match.submitterName?.trim() ||
        match.submitterRole?.trim(),
    );

    const handleOpenKioskModal = (e: React.MouseEvent) => {
      e.stopPropagation();

      if (onReportKioskInfo) {
        onReportKioskInfo(match);
      } else {
        setIsLocalModalOpen(true);
      }
    };

    return (
      <>
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
                  className="text-[11px] cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                  title="Topspiel-Details & Berechnungsgrundlage anzeigen"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTopMatchModalOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsTopMatchModalOpen(true);
                    }
                  }}
                >
                  <span className="mr-1" aria-hidden="true">
                    ⭐
                  </span>
                  Topspiel
                </Badge>
              )}

              {hasPendingOffline && (
                <Badge
                  variant="outline"
                  data-testid="kiosk-offline-pending-badge"
                  className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 text-[10px] font-semibold"
                >
                  <Clock className="mr-1 h-2.5 w-2.5 shrink-0" />
                  Info ausstehend (Offline)
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

          {/* Kiosk, Admission & Parking Badges */}
          {hasKioskOrVenueInfo && (
            <KioskInfoBadges
              match={match}
              className="mt-2.5 border-t border-border/30 pt-2.5"
            />
          )}

          {kioskTeaser && !hasKioskOrVenueInfo && (
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
          <div className="flex flex-wrap items-center justify-between gap-2 w-full">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span>{dateFormatted}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-action="kiosk-submission"
                onClick={handleOpenKioskModal}
                onKeyDown={(e) => e.stopPropagation()}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 text-[11px] font-semibold text-amber-300 transition-colors hover:border-amber-400/60 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
              >
                <span aria-hidden="true">🌭</span>
                <span>Kiosk- & Hallen-Info melden</span>
              </button>

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
                <span className="hidden sm:inline">Auf Karte anzeigen</span>
                <span className="sm:hidden">Karte</span>
              </Button>
            </div>
          </div>

          <div className="w-full border-t border-border/20 pt-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              DBB Quick-Actions
            </span>

            <MatchQuickActions match={match} />
          </div>
        </CardFooter>
      </Card>

      {!onReportKioskInfo && (
        <>
          <KioskSubmissionModal
            match={match}
            isOpen={isLocalModalOpen}
            onClose={() => setIsLocalModalOpen(false)}
            onSuccess={(msg) => {
              setLocalToast(msg);
              setTimeout(() => setLocalToast(null), 5000);
            }}
          />

          {localToast && (
            <div
              role="status"
              className="fixed bottom-20 left-1/2 z-70 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
            >
              <span>{localToast}</span>
            </div>
          )}
        </>
      )}

      {/* Top Match Calculation Info Modal */}
      <TopMatchInfoModal
        match={match}
        isOpen={isTopMatchModalOpen}
        onClose={() => setIsTopMatchModalOpen(false)}
      />
      </>
    );
  },
);

MatchCard.displayName = 'MatchCard';
