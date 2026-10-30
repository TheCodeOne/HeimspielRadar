import * as React from 'react';
import {
  Calendar,
  Camera,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { MapContainer } from '@/components/map';
import { formatLeagueName } from '@/components/map/map-utils';
import { MatchQuickActions } from '@/components/matches/MatchQuickActions';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { getMatchLinks } from '@/lib/match-links';
import { getSampleMatches } from '@/lib/sample-matches';
import { shareMatch } from '@/lib/share-utils';

export interface MatchDetailViewProps {
  matchId: number;
  onNavigateHome: () => void;
}

export interface SplitTeamNameResult {
  base: string;
  suffix?: string;
}

/**
 * Splits a basketball team name into the club name and optional team number/suffix
 * (e.g. "TSG Reutlingen 2" -> { base: "TSG Reutlingen", suffix: "2" })
 * so the suffix never awkwardly wraps alone onto a new line.
 */
function splitTeamName(name: string): SplitTeamNameResult {
  const trimmed = name.trim();
  const match = trimmed.match(/^(.*)\s+(\d+|[IVX]+|[A-Z])$/);

  if (match) {
    return { base: match[1], suffix: match[2] };
  }

  return { base: trimmed };
}

export function MatchDetailView({ matchId, onNavigateHome }: MatchDetailViewProps) {
  const [match, setMatch] = React.useState<Match | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    const timer = setTimeout(() => setToastMessage(null), 3000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    async function loadMatch() {
      try {
        const res = await fetch(`/api/matches/${matchId}`);

        if (res.ok) {
          // SAFETY: Backend returns domain Match DTO
          const data = (await res.json()) as Match;

          if (!isCancelled) {
            setMatch(data);
            setIsLoading(false);
          }

          return;
        }
      } catch {
        // Fall back to sample matches if offline or backend is unconfigured
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

  const handleShare = async () => {
    if (!match) {
      return;
    }

    const result = await shareMatch(match, {
      onSuccess: (type) => {
        showToast(
          type === 'copied'
            ? 'Link zum Spiel in die Zwischenablage kopiert!'
            : 'Spiel erfolgreich geteilt!'
        );
      },
      onError: () => {
        showToast('Teilen fehlgeschlagen');
      },
    });

    if (result === 'copied') {
      showToast('Link zum Spiel in die Zwischenablage kopiert!');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm font-medium text-muted-foreground">
            Lade Spieldetails...
          </span>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-4 text-center text-foreground">
        <h1 className="text-2xl font-bold tracking-tight">Spiel nicht gefunden</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Das aufgerufene Spiel mit der ID {matchId} konnte leider nicht gefunden werden.
        </p>
        <Button
          type="button"
          onClick={onNavigateHome}
          className="mt-6 gap-2"
          variant="outline"
        >
          ← Zum Heimspielradar
        </Button>
      </div>
    );
  }

  const links = getMatchLinks(match);
  const isFinished = Boolean(match.result);
  const leagueName = formatLeagueName(match.leagueId, match.league?.name);
  const dateFormatted = formatDisplayDate(match.kickoffDate);
  const timeFormatted = formatKickoffTime(match.kickoffTime);

  const venueCoords: [number, number] =
    match.venue?.latitude != null && match.venue?.longitude != null
      ? [match.venue.latitude, match.venue.longitude]
      : [48.7758, 9.1829];

  const homeParts = splitTeamName(match.homeTeam.name);
  const guestParts = splitTeamName(match.guestTeam.name);

  return (
    <div className="fixed inset-0 flex h-dvh max-h-dvh w-full flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 flex h-12 sm:h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-3 backdrop-blur-md sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNavigateHome}
          className="gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <span>← Zum Heimspielradar</span>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Teilen</span>
          </Button>
        </div>
      </header>

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
        >
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Body - Centered Ticket layout that fits completely within 100dvh without scrolling */}
      <main className="relative flex flex-1 min-h-0 w-full flex-col items-center justify-center p-2 sm:p-4 overflow-hidden bg-radial from-slate-900/60 to-slate-950/95">
        <div className="relative w-full max-w-sm sm:max-w-md h-full max-h-[calc(100dvh-4rem)] flex flex-col rounded-3xl border border-slate-700/80 bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden select-none">
          {/* Perforation Cutouts */}
          <div
            aria-hidden="true"
            className="absolute top-[68px] sm:top-[76px] -left-3.5 z-20 h-7 w-7 rounded-full bg-background border-r border-slate-700/80 shadow-inner"
          />
          <div
            aria-hidden="true"
            className="absolute top-[68px] sm:top-[76px] -right-3.5 z-20 h-7 w-7 rounded-full bg-background border-l border-slate-700/80 shadow-inner"
          />

          {/* 1. Ticket Header Stub */}
          <div className="relative shrink-0 bg-gradient-to-r from-orange-600/25 via-primary/20 to-amber-600/25 px-5 py-2.5 sm:py-3 border-b border-dashed border-slate-700/80">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-black uppercase tracking-widest text-primary">
                  HeimspielRadar Ticket
                </span>
              </div>

              {match.matchDay && (
                <span className="font-mono text-[10px] text-slate-400">
                  {match.matchDay}. Spieltag {match.matchNo ? `• #${match.matchNo}` : ''}
                </span>
              )}
            </div>

            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-bold text-foreground tracking-tight">
                {leagueName}
              </span>
            </div>
          </div>

          {/* 2. Middle Content Grid (Flex column fitting exactly without scrolling) */}
          <div className="p-3 sm:p-4 flex-1 min-h-0 flex flex-col gap-2 sm:gap-3 overflow-hidden">
            {/* Matchup Teams Banner */}
            <div className="shrink-0 rounded-2xl bg-card/60 p-2.5 sm:p-3 border border-border/50 text-center">
              <div className="flex items-center justify-center gap-2">
                {/* Home Team */}
                <div className="flex-1 text-right">
                  <div className="text-xs sm:text-sm md:text-base font-black text-foreground leading-tight">
                    <span>{homeParts.base}</span>
                    {homeParts.suffix && (
                      <span className="whitespace-nowrap ml-1 text-primary">{homeParts.suffix}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono uppercase text-primary font-bold">Heim</span>
                </div>

                {/* VS / Result */}
                <div className="shrink-0 flex flex-col items-center px-1">
                  {isFinished ? (
                    <div className="rounded-lg bg-primary/20 border border-primary/40 px-2 py-0.5 font-mono text-xs font-black text-primary">
                      {match.result}
                    </div>
                  ) : (
                    <div className="rounded-full bg-slate-800/90 border border-slate-700/70 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                      VS
                    </div>
                  )}
                </div>

                {/* Guest Team */}
                <div className="flex-1 text-left">
                  <div className="text-xs sm:text-sm md:text-base font-black text-foreground leading-tight">
                    <span>{guestParts.base}</span>
                    {guestParts.suffix && (
                      <span className="whitespace-nowrap ml-1 text-slate-300">{guestParts.suffix}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">Gast</span>
                </div>
              </div>

              {/* Anpfiff Date & Time */}
              <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-center gap-2 text-xs">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Calendar className="h-3 w-3 text-primary" />
                  {dateFormatted}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="flex items-center gap-1 font-mono font-semibold text-primary">
                  <Clock className="h-3 w-3 text-primary" />
                  {timeFormatted}
                </span>
              </div>
            </div>

            {/* Embedded Map Section */}
            <div className="flex-1 min-h-[140px] sm:min-h-[170px] relative rounded-2xl overflow-hidden border border-border/60">
              <MapContainer
                matches={[match]}
                selectedMatchId={match.id}
                center={venueCoords}
                zoom={12}
                radiusKm={15}
                showRadiusCircle={false}
                onMarkerClick={() => {}}
                className="h-full w-full border-0 rounded-none"
                mapHeightClassName="h-full w-full"
              />

              {/* Venue Overlay inside Map */}
              {match.venue && (
                <div className="absolute bottom-2 left-2 right-2 z-10 rounded-xl bg-slate-950/85 p-2 backdrop-blur-md border border-slate-800/80 shadow-md flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-[11px] font-bold text-foreground truncate">
                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                      <span className="truncate">{match.venue.name}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate pl-4">
                      {match.venue.street ? `${match.venue.street}, ` : ''}{match.venue.postalCode} {match.venue.city}
                    </div>
                  </div>

                  {links.navigationUrl && (
                    <a
                      href={links.navigationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/20 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/30 transition"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Route</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* 3. Ticket Footer: Quick Actions / DBB Links */}
            <div className="shrink-0 rounded-2xl bg-card/40 p-2 sm:p-2.5 border border-border/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-border/60"
                >
                  <Share2 className="h-3 w-3 text-primary" />
                  <span>Teilen</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.history.pushState({}, '', `/story/${match.id}`);
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <Camera className="h-3 w-3" />
                  <span>📸 Story</span>
                </Button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="hidden xs:inline text-[10px] font-mono uppercase text-muted-foreground mr-1">
                  DBB Links:
                </span>
                <MatchQuickActions
                  match={match}
                  size="sm"
                  onShareFeedback={showToast}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
