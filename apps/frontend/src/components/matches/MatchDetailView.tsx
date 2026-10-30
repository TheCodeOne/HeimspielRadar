import * as React from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Share2,
  Trophy,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { MapContainer } from '@/components/map';
import { formatLeagueName } from '@/components/map/map-utils';
import { MatchQuickActions } from '@/components/matches/MatchQuickActions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { formatDistance } from '@/lib/geo-utils';
import { getMatchLinks } from '@/lib/match-links';
import { getSampleMatches } from '@/lib/sample-matches';
import { shareMatch } from '@/lib/share-utils';

export type DetailVariant = 'A' | 'B' | 'C';

export interface MatchDetailViewProps {
  matchId: number;
  onNavigateHome: () => void;
}

export function MatchDetailView({ matchId, onNavigateHome }: MatchDetailViewProps) {
  const [match, setMatch] = React.useState<Match | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const [selectedVariant, setSelectedVariant] = React.useState<DetailVariant>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('variant');

      if (param === 'A' || param === 'B' || param === 'C') {
        return param;
      }
    }

    return 'A';
  });

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

  const handleSelectVariant = (v: DetailVariant) => {
    setSelectedVariant(v);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', v);
      window.history.replaceState({}, '', url.toString());
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
          <ArrowLeft className="h-4 w-4" />
          Zur Übersicht / Alle Spiele
        </Button>
      </div>
    );
  }

  const links = getMatchLinks(match);
  const isFinished = Boolean(match.result);
  const leagueName = formatLeagueName(match.leagueId, match.league?.name);
  const dateFormatted = formatDisplayDate(match.kickoffDate);
  const timeFormatted = formatKickoffTime(match.kickoffTime);
  const categoryParts = [match.league?.akName, match.league?.geschlecht].filter(Boolean);

  const venueCoords: [number, number] =
    match.venue?.latitude != null && match.venue?.longitude != null
      ? [match.venue.latitude, match.venue.longitude]
      : [48.7758, 9.1829];

  return (
    <div className="fixed inset-0 flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-3 backdrop-blur-md sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNavigateHome}
          className="gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Zur Übersicht / Alle Spiele</span>
        </Button>

        {/* Prototype Switcher Pill for Variants A, B, C */}
        <div className="flex items-center gap-1 rounded-full border border-border/80 bg-card/80 p-0.5 text-xs font-medium shadow-xs">
          <button
            type="button"
            onClick={() => handleSelectVariant('A')}
            className={`rounded-full px-2.5 py-1 transition ${
              selectedVariant === 'A'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            A: Split
          </button>
          <button
            type="button"
            onClick={() => handleSelectVariant('B')}
            className={`rounded-full px-2.5 py-1 transition ${
              selectedVariant === 'B'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            B: Hero-Map
          </button>
          <button
            type="button"
            onClick={() => handleSelectVariant('C')}
            className={`rounded-full px-2.5 py-1 transition ${
              selectedVariant === 'C'
                ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            C: Ticket
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShare}
            className="gap-1.5 text-xs font-medium"
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
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
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

      {/* Main Body per Variant */}
      <main className="relative flex flex-1 min-h-0 w-full overflow-hidden">
        {selectedVariant === 'A' && (
          /* VARIANT A: SPLIT-VIEW (Desktop side-by-side / Mobile stacked) */
          <div className="flex flex-1 flex-col md:flex-row h-full w-full overflow-hidden">
            {/* Detail Focus Panel */}
            <div className="w-full md:w-[480px] lg:w-[540px] shrink-0 border-b md:border-b-0 md:border-r border-border/70 overflow-y-auto p-4 sm:p-6 space-y-5 bg-card/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="league" className="text-xs">
                    <Trophy className="mr-1 h-3.5 w-3.5" />
                    {leagueName}
                  </Badge>
                  {categoryParts.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {categoryParts.join(' • ')}
                    </Badge>
                  )}
                  <Badge variant="kickoff" className="text-xs">
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    {timeFormatted}
                  </Badge>
                </div>

                {isFinished ? (
                  <Badge variant="secondary" className="font-mono font-bold text-primary">
                    {match.result}
                  </Badge>
                ) : match.confirmed ? (
                  <Badge variant="success" className="text-xs">
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Bestätigt
                  </Badge>
                ) : (
                  <Badge variant="warning" className="text-xs">
                    Vorläufig
                  </Badge>
                )}
              </div>

              {/* Matchup Teams Banner */}
              <Card className="border-border/80 bg-background/60 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Heim
                      </span>
                      <div className="text-lg sm:text-xl font-extrabold text-foreground leading-tight">
                        {match.homeTeam.name}
                      </div>
                    </div>

                    <div className="shrink-0 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs font-bold text-muted-foreground">
                      VS
                    </div>

                    <div className="flex-1 space-y-1 text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Gast
                      </span>
                      <div className="text-lg sm:text-xl font-extrabold text-foreground leading-tight">
                        {match.guestTeam.name}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span>{dateFormatted}</span>
                    </div>
                    <span className="font-mono text-xs">
                      {match.matchDay}. Spieltag {match.matchNo ? `(Nr. ${match.matchNo})` : ''}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Venue Card */}
              {match.venue && (
                <div className="rounded-xl border border-border/70 bg-card/60 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>Austragungsort</span>
                      </div>
                      <div className="font-bold text-foreground text-sm sm:text-base">
                        {match.venue.name}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {match.venue.street}, {match.venue.postalCode} {match.venue.city}
                      </p>
                    </div>

                    {links.navigationUrl && (
                      <a
                        href={links.navigationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>Navigation</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* DBB Links & Quick Actions */}
              <div className="space-y-2.5 rounded-xl border border-border/70 bg-card/60 p-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  DBB Aktionen & Statistiken
                </span>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    Direktzugriff auf Spielinfo, Boxscore & Tabelle:
                  </span>
                  <MatchQuickActions
                    match={match}
                    onShareFeedback={showToast}
                  />
                </div>
              </div>
            </div>

            {/* Map Container Right */}
            <div className="relative flex-1 h-full min-h-[300px] w-full">
              <MapContainer
                matches={[match]}
                selectedMatchId={match.id}
                center={venueCoords}
                zoom={14}
                radiusKm={15}
                showRadiusCircle={false}
                onMarkerClick={() => {}}
                className="h-full w-full border-0 rounded-none"
                mapHeightClassName="h-full w-full"
              />
            </div>
          </div>
        )}

        {selectedVariant === 'B' && (
          /* VARIANT B: IMMERSIVE MAP FOCUS WITH FLOATING HERO CARD / BOTTOM SHEET */
          <div className="relative flex-1 h-full w-full">
            <MapContainer
              matches={[match]}
              selectedMatchId={match.id}
              center={venueCoords}
              zoom={14}
              radiusKm={15}
              showRadiusCircle={false}
              onMarkerClick={() => {}}
              className="h-full w-full border-0 rounded-none"
              mapHeightClassName="h-full w-full"
            />

            {/* Floating Hero Card at bottom or top-left */}
            <div className="absolute bottom-4 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-md z-30 pointer-events-auto">
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/95 p-4 sm:p-5 shadow-2xl backdrop-blur-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="league" className="text-[11px]">
                    <Trophy className="mr-1 h-3 w-3" />
                    {leagueName}
                  </Badge>
                  <span className="font-mono text-xs font-semibold text-primary">
                    {dateFormatted} • {timeFormatted}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-base sm:text-lg font-bold text-foreground">
                  <span className="truncate">{match.homeTeam.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">vs</span>
                  <span className="truncate text-right">{match.guestTeam.name}</span>
                </div>

                {match.venue && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/40 pt-2">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate font-medium text-foreground">{match.venue.name}</span>
                      <span>• {match.venue.city}</span>
                    </div>
                    {match.distanceKm != null && (
                      <span className="font-mono text-[11px] text-primary shrink-0">
                        {formatDistance(match.distanceKm)}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border/40 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    className="h-8 gap-1.5 text-xs font-semibold"
                  >
                    <Share2 className="h-3.5 w-3.5 text-primary" />
                    <span>Teilen</span>
                  </Button>

                  <MatchQuickActions
                    match={match}
                    onShareFeedback={showToast}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedVariant === 'C' && (
          /* VARIANT C: STANDALONE EVENT-TICKET / MATCHDAY-POSTER CARD */
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center items-start bg-slate-950/50">
            <div className="w-full max-w-xl rounded-3xl border border-slate-700/80 bg-slate-900/90 shadow-2xl backdrop-blur-xl overflow-hidden">
              {/* Ticket Header Banner */}
              <div className="relative bg-gradient-to-r from-orange-600/30 via-primary/20 to-amber-600/30 p-6 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="border-primary/40 bg-primary/20 text-primary font-bold">
                    MATCHDAY TICKET
                  </Badge>
                  <span className="font-mono text-xs text-slate-300">
                    {match.matchDay}. Spieltag {match.matchNo ? `#${match.matchNo}` : ''}
                  </span>
                </div>

                <div className="mt-4 text-center space-y-1">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                    {leagueName} {categoryParts.length > 0 ? `(${categoryParts.join(' • ')})` : ''}
                  </span>
                  <div className="flex items-center justify-center gap-3 sm:gap-6 pt-2">
                    <div className="flex-1 text-right">
                      <div className="text-lg sm:text-2xl font-black text-foreground">
                        {match.homeTeam.name}
                      </div>
                      <span className="text-[10px] font-mono uppercase text-primary">Heim</span>
                    </div>

                    <div className="shrink-0 flex flex-col items-center">
                      {isFinished ? (
                        <div className="rounded-xl bg-primary/20 border border-primary/40 px-3 py-1 font-mono text-base font-extrabold text-primary">
                          {match.result}
                        </div>
                      ) : (
                        <div className="rounded-full bg-slate-800/80 px-2.5 py-1 font-mono text-xs font-bold text-muted-foreground">
                          VS
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <div className="text-lg sm:text-2xl font-black text-foreground">
                        {match.guestTeam.name}
                      </div>
                      <span className="text-[10px] font-mono uppercase text-slate-400">Gast</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ticket Body Details */}
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4 rounded-2xl bg-card/40 p-4 border border-border/40 text-xs">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Datum & Uhrzeit
                    </span>
                    <p className="font-bold text-foreground text-sm">
                      {dateFormatted}
                    </p>
                    <p className="font-mono text-slate-300">{timeFormatted}</p>
                  </div>

                  <div className="space-y-1">
                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" /> Austragungsort
                    </span>
                    <p className="font-bold text-foreground text-sm truncate">
                      {match.venue?.name || 'Halle offen'}
                    </p>
                    <p className="text-muted-foreground truncate">
                      {match.venue ? `${match.venue.postalCode} ${match.venue.city}` : 'Keine Adresse'}
                    </p>
                  </div>
                </div>

                {/* Embedded Mini-Map */}
                <div className="h-44 w-full rounded-2xl overflow-hidden border border-border/60">
                  <MapContainer
                    matches={[match]}
                    selectedMatchId={match.id}
                    center={venueCoords}
                    zoom={14}
                    radiusKm={15}
                    showRadiusCircle={false}
                    onMarkerClick={() => {}}
                    className="h-full w-full border-0 rounded-none"
                    mapHeightClassName="h-full w-full"
                  />
                </div>

                {/* Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-4">
                  <Button
                    type="button"
                    onClick={handleShare}
                    className="gap-2 text-xs font-semibold"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Spiel weiterleiten</span>
                  </Button>

                  <MatchQuickActions
                    match={match}
                    onShareFeedback={showToast}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
