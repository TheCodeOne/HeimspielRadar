import * as React from 'react';
import {
  Calendar,
  Camera,
  Clock,
  ExternalLink,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { Match, TeamSuggestion } from '@sundayleague/shared-types';
import { TeamSearchInput } from '@/components/filters/shared/TeamSearchInput';
import { Button } from '@/components/ui/button';
import { TopLoadingBar } from '@/components/ui/TopLoadingBar';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';
import { getSampleMatches } from '@/lib/sample-matches';
import {
  STORY_CLUB_STORAGE_KEY,
  getInitialStoryClub,
  persistStoryClub,
} from '@/lib/story-club-storage';
import { parseMatchScore } from '@/lib/story-image-generator';
import { StoryEditorView } from './StoryEditorView';
import { AppHeader } from '@/components/navigation';

export interface ClubStoryHubProps {
  onNavigateHome: () => void;
  onOpenNav?: () => void;
}

export type ClubStoryHubTab = 'upcoming' | 'results' | 'all';

export { STORY_CLUB_STORAGE_KEY };

export function ClubStoryHub({ onNavigateHome, onOpenNav }: ClubStoryHubProps) {
  const [selectedClub, setSelectedClub] = React.useState<string>(getInitialStoryClub);
  const [activeTab, setActiveTab] = React.useState<ClubStoryHubTab>('upcoming');
  const [allMatches, setAllMatches] = React.useState<Match[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [editingMatch, setEditingMatch] = React.useState<Match | null>(null);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  const showToast = React.useCallback((message: string) => {
    setToastMessage(message);
    const timer = setTimeout(() => setToastMessage(null), 3500);

    return () => clearTimeout(timer);
  }, []);

  // Fetch matches from API with optional team search (or fallback to sample data)
  React.useEffect(() => {
    const trimmed = selectedClub.trim();

    if (!trimmed) {
      setAllMatches([]);
      setIsLoading(false);

      return;
    }

    let isCancelled = false;
    const abortController = new AbortController();

    setIsLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.set('teamQuery', trimmed);

    fetch(`/api/matches?${queryParams.toString()}`, {
      signal: abortController.signal,
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load matches: ${res.status}`);
        }

        return res.json();
      })
      .then((data: Match[]) => {
        if (!isCancelled) {
          setAllMatches(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!isCancelled && !abortController.signal.aborted) {
          // Fallback to sample matches if API is unavailable or offline
          const samples = getSampleMatches();
          const q = trimmed.toLowerCase();

          setAllMatches(
            samples.filter(
              (m) =>
                m.homeTeam.name.toLowerCase().includes(q) ||
                m.guestTeam.name.toLowerCase().includes(q)
            )
          );
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [selectedClub]);

  // Filter matches based on active tab
  const filteredMatches = React.useMemo(() => {
    if (activeTab === 'upcoming') {
      return allMatches.filter((m) => !m.result);
    }

    if (activeTab === 'results') {
      return allMatches.filter((m) => Boolean(m.result));
    }

    return allMatches;
  }, [allMatches, activeTab]);

  const handleSelectSuggestion = (suggestion: TeamSuggestion) => {
    setSelectedClub(suggestion.name);
    persistStoryClub(suggestion.name);
  };

  const handleSelectRawQuery = (query: string) => {
    setSelectedClub(query);
    persistStoryClub(query);
  };

  const handleClearClub = () => {
    setSelectedClub('');
    persistStoryClub('');
  };

  const handleOpenEditor = (match: Match) => {
    // Update browser URL if supported for shareable link /story/:id
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/story/${match.id}`);
    }

    setEditingMatch(match);
  };

  if (editingMatch) {
    return (
      <StoryEditorView
        match={editingMatch}
        onBack={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/story');
          }

          setEditingMatch(null);
        }}
        onShareFeedback={showToast}
      />
    );
  }

  return (
    <div className="fixed inset-0 h-dvh w-full flex flex-col overflow-y-auto bg-background text-foreground">
      {/* Top Loading Progress Bar */}
      <TopLoadingBar isLoading={isLoading} />

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-full bg-card/95 text-card-foreground px-5 py-2.5 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur border border-border animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {toastMessage}
        </div>
      )}

      {/* Global Unified App Header */}
      <AppHeader
        onOpenNav={onOpenNav ?? (() => {})}
        onNavigateHome={onNavigateHome}
        backLink={{
          label: 'Zum Heimspielradar',
          onClick: onNavigateHome,
        }}
      />

      {/* Hero / Header */}
      <section className="px-4 pt-8 pb-6 sm:px-8 max-w-5xl mx-auto w-full text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary mb-3">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Vereins-Hub • Instagram Story Generator</span>
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
          Matchday Storys für deinen Verein
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-2xl">
          Wähle deinen Verein oder ein Spiel aus und erstelle mit einem Klick druckreife 9:16 Matchday-Grafiken für deine Instagram & WhatsApp Storys – inklusive Link-Sticker Guide!
        </p>

        {/* Search Bar */}
        <div className="mt-6 max-w-xl">
          <TeamSearchInput
            value={selectedClub}
            onSelectSuggestion={handleSelectSuggestion}
            onSelectRawQuery={handleSelectRawQuery}
            onClear={handleClearClub}
            placeholder="Verein suchen (z.B. TSG Reutlingen, SV 03 Tübingen)..."
          />
        </div>
      </section>

      {/* Match Table / Selection Grid */}
      <main className="flex-1 px-4 pb-12 sm:px-8 max-w-5xl mx-auto w-full">
        {!selectedClub.trim() ? (
          <div
            data-testid="story-onboarding-prompt"
            className="text-center py-16 sm:py-20 bg-card/30 rounded-2xl border border-dashed border-border/60 px-4"
          >
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 text-primary mb-4">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              Wähle oben deinen Verein oder dein Team aus
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Wähle oben deinen Verein oder dein Team aus, um Matchday-Storys zu erstellen.
            </p>
          </div>
        ) : (
          <>
            {/* Tab Filter: Anstehende Spiele vs Letzte Ergebnisse vs Alle */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40 mb-4">
              <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/60">
                <button
                  type="button"
                  onClick={() => setActiveTab('upcoming')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'upcoming'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Anstehende Spiele
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('results')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'results'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Letzte Ergebnisse
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    activeTab === 'all'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Alle Spiele
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {`Spiele für „${selectedClub}“ (${filteredMatches.length})`}
                </span>
                {isLoading && (
                  <span className="text-xs text-muted-foreground animate-pulse">
                    Lade...
                  </span>
                )}
              </div>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="text-center py-16 bg-card/30 rounded-2xl border border-dashed border-border/60">
                <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-60" />
                <h3 className="text-base font-semibold text-foreground">Keine Spiele gefunden</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                  Für die aktuelle Auswahl liegen zurzeit keine Spielansetzungen vor. Versuche einen anderen Suchbegriff.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearClub}
                  className="mt-4"
                >
                  Filter zurücksetzen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {filteredMatches.map((match) => {
                  const isFinished = Boolean(match.result);
                  const dateStr = formatDisplayDate(match.kickoffDate);
                  const timeStr = formatKickoffTime(match.kickoffTime);

                  return (
                    <div
                      key={match.id}
                      className="rounded-2xl bg-card border border-border/60 hover:border-primary/50 transition p-4 flex flex-col justify-between shadow-sm relative group"
                    >
                      {/* Card Header: League & Status */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/30">
                        <span className="font-semibold text-primary truncate max-w-[200px] sm:max-w-[250px]">
                          {match.league?.name || 'Amateur-Basketball'}
                        </span>
                        <span className="shrink-0 text-[11px] font-mono">
                          {isFinished ? 'Beendet' : `${dateStr}`}
                        </span>
                      </div>

                      {/* Teams */}
                      <div className="py-3 flex flex-col gap-1">
                        {(() => {
                          const score = parseMatchScore(match.result);
                          const homeIsWinner = score?.winner === 'home';
                          const guestIsWinner = score?.winner === 'guest';

                          return (
                            <>
                              <div className="flex items-baseline justify-between">
                                <span className={`text-sm sm:text-base font-bold ${homeIsWinner ? 'text-primary' : 'text-foreground'}`}>
                                  {match.homeTeam.name}
                                </span>
                                {score && (
                                  <span className={`text-sm font-mono font-bold ${homeIsWinner ? 'text-primary' : 'text-foreground'}`}>
                                    {score.home}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] font-black uppercase text-muted-foreground/60">
                                {score ? 'Ergebnis' : 'vs'}
                              </div>
                              <div className="flex items-baseline justify-between">
                                <span className={`text-sm sm:text-base font-bold ${guestIsWinner ? 'text-primary' : 'text-foreground'}`}>
                                  {match.guestTeam.name}
                                </span>
                                {score && (
                                  <span className={`text-sm font-mono font-bold ${guestIsWinner ? 'text-primary' : 'text-foreground'}`}>
                                    {score.guest}
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      {/* Footer: Date, Venue & Generate Button */}
                      <div className="pt-2 border-t border-border/30 flex items-center justify-between gap-2 mt-auto">
                        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground flex flex-col gap-0.5">
                          <div className="flex items-center gap-1 font-semibold text-foreground truncate">
                            <Clock className="h-3 w-3 text-primary shrink-0" />
                            <span>{timeStr}</span>
                          </div>
                          <div className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{match.venue?.name || match.venue?.city || 'Halle'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={`/matches/${match.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground transition"
                            title="Spieldetails ansehen"
                            aria-label="Spieldetails ansehen"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenEditor(match)}
                            className="h-8 px-3 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            <span>Story anpassen</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
