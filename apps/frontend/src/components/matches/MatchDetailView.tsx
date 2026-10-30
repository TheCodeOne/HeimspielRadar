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
import { shareMatch, shareMatchStory } from '@/lib/share-utils';
import { splitTeamName } from '@/lib/story-image-generator';

export interface MatchDetailViewProps {
  matchId: number;
  onNavigateHome: () => void;
}

export function MatchDetailView({ matchId, onNavigateHome }: MatchDetailViewProps) {
  const [match, setMatch] = React.useState<Match | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGeneratingStory, setIsGeneratingStory] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    const timer = setTimeout(() => setToastMessage(null), 3000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);

    fetch(`/api/matches/${matchId}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load match: ${res.status}`);
        }

        return res.json();
      })
      .then((data: Match) => {
        if (!isCancelled) {
          setMatch(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          // Fallback to sample matches if API is unavailable or in offline/prototype mode
          const sample = getSampleMatches().find((m) => m.id === matchId) || null;

          setMatch(sample);
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [matchId]);

  // Update HTML title on match load
  React.useEffect(() => {
    if (match) {
      document.title = `${match.homeTeam.name} vs ${match.guestTeam.name} – HeimspielRadar`;
    }

    return () => {
      document.title = 'HeimspielRadar – Amateur-Basketball in deiner Nähe';
    };
  }, [match]);

  const handleShare = async () => {
    if (!match) {
      return;
    }

    const result = await shareMatch(match, {
      onSuccess: (type) => {
        if (type === 'shared') {
          showToast('Spiel geteilt!');
        } else {
          showToast('Link zum Spiel in die Zwischenablage kopiert!');
        }
      },
      onError: () => {
        showToast('Teilen fehlgeschlagen');
      },
    });

    if (result === 'copied') {
      showToast('Link zum Spiel in die Zwischenablage kopiert!');
    }
  };

  const handleStoryShare = async () => {
    if (!match || isGeneratingStory) {
      return;
    }

    setIsGeneratingStory(true);
    showToast('Story-Bild wird erstellt...');

    await shareMatchStory(match, {
      theme: 'auto',
      onSuccess: (type) => {
        setIsGeneratingStory(false);

        if (type === 'shared') {
          showToast('Story geöffnet & Link für Sticker kopiert!');
        } else {
          showToast('Story heruntergeladen & Link für Sticker kopiert!');
        }
      },
      onError: () => {
        setIsGeneratingStory(false);
        showToast('Story-Generierung fehlgeschlagen');
      },
    });
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
    <div className="h-dvh w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-900/90 text-white px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur border border-slate-700/80 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Top Navigation Bar */}
      <header className="shrink-0 flex items-center justify-between border-b border-border/50 px-3 py-2.5 sm:px-6 bg-card/60 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNavigateHome}
            className="text-xs font-medium -ml-1 text-muted-foreground hover:text-foreground"
          >
            ← Zum Heimspielradar
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleStoryShare}
            disabled={isGeneratingStory}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Story erstellen</span>
            <span className="sm:hidden">Story</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 border-border/60"
          >
            <Share2 className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Teilen</span>
          </Button>
        </div>
      </header>

      {/* Main Ticket View (Fills remaining height without scrolling if possible) */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
        {/* Ticket Container */}
        <div className="relative w-full max-w-xl mx-auto rounded-3xl bg-card border border-border/70 shadow-2xl overflow-hidden flex flex-col max-h-full">
          {/* Header Ticket Section */}
          <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-4 py-3 sm:px-6 sm:py-4 border-b border-border/60 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-primary">
                {leagueName}
              </span>
              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                {match.round && <span>Spieltag {match.round}</span>}
                {match.league?.gender && (
                  <span className="capitalize">
                    {match.league.gender === 'm'
                      ? 'Herren'
                      : match.league.gender === 'w'
                      ? 'Damen'
                      : 'Mixed'}
                  </span>
                )}
                {match.league?.ageClass && (
                  <span className="capitalize">{match.league.ageClass}</span>
                )}
              </div>
            </div>

            {isFinished ? (
              <span className="shrink-0 rounded-full bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                Beendet
              </span>
            ) : (
              <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Anstehend
              </span>
            )}
          </div>

          {/* Ticket Body: Match Teams & Score */}
          <div className="p-4 sm:p-6 flex flex-col gap-4 flex-1">
            <div className="grid grid-cols-11 items-center gap-2 py-2 sm:py-4">
              {/* Home Team */}
              <div className="col-span-5 text-right flex flex-col items-end justify-center min-w-0">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Heim
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                  <span className="break-words">{homeParts.base}</span>
                  {homeParts.suffix && (
                    <span className="whitespace-nowrap font-black text-primary ml-1.5">
                      {homeParts.suffix}
                    </span>
                  )}
                </span>
              </div>

              {/* VS or Result Divider */}
              <div className="col-span-1 flex flex-col items-center justify-center">
                {isFinished && match.result ? (
                  <div className="flex flex-col items-center">
                    <span className="text-lg sm:text-2xl font-black font-mono tracking-tight text-primary">
                      {match.result.home}:{match.result.guest}
                    </span>
                  </div>
                ) : (
                  <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-muted/70 flex items-center justify-center border border-border/80">
                    <span className="text-[10px] sm:text-xs font-black text-muted-foreground uppercase">
                      VS
                    </span>
                  </div>
                )}
              </div>

              {/* Guest Team */}
              <div className="col-span-5 text-left flex flex-col items-start justify-center min-w-0">
                <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Gast
                </span>
                <span className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-foreground leading-tight">
                  <span className="break-words">{guestParts.base}</span>
                  {guestParts.suffix && (
                    <span className="whitespace-nowrap font-black text-primary ml-1.5">
                      {guestParts.suffix}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Date & Kickoff Info Pill */}
            <div className="rounded-xl bg-muted/30 border border-border/50 px-3 py-2 sm:px-4 sm:py-2.5 flex items-center justify-center gap-4 sm:gap-6 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <span>{dateFormatted}</span>
              </div>
              <div className="h-3 w-px bg-border/60" />
              <div className="flex items-center gap-1.5 text-foreground font-semibold">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>{timeFormatted}</span>
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
                  onClick={handleStoryShare}
                  disabled={isGeneratingStory}
                  className="h-7 px-2.5 text-xs font-semibold gap-1.5 border-primary/50 text-primary hover:bg-primary/10"
                >
                  <Camera className="h-3 w-3" />
                  <span>Story</span>
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
