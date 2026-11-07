import * as React from 'react';
import {
  CheckCircle2,
  Clock,
  Info,
  Sparkles,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { formatLeagueName } from '@/components/map/map-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, formatKickoffTime } from '@/lib/date-utils';

export interface TopMatchInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
}

export function TopMatchInfoModal({
  isOpen,
  onClose,
  match,
}: TopMatchInfoModalProps) {
  // ESC key handler to close modal
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) {
    return null;
  }

  const leagueName = formatLeagueName(match.leagueId, match.league?.name);
  const featuredMeta = match.featuredMeta;

  const isAlgorithm = featuredMeta?.type === 'algorithm';
  const algorithmMeta = isAlgorithm ? featuredMeta : null;

  const isAdmin =
    featuredMeta?.type === 'admin' ||
    match.featuredReason === 'Von Admin ausgewählt';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="top-match-info-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overscroll-contain pointer-events-auto"
      data-testid="top-match-info-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div
        className="relative z-10 flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border/60 p-4 sm:p-5 pb-3 bg-card/40">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/15 text-amber-300 shadow-xs">
              <Star className="h-4.5 w-4.5 fill-amber-400 text-amber-400" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2
                  id="top-match-info-title"
                  className="text-base font-bold text-foreground leading-tight"
                >
                  Topspiel des Tages
                </h2>
                <Badge
                  variant="featured"
                  className="text-[10px] uppercase tracking-wide px-1.5 py-0"
                >
                  Highlight
                </Badge>
              </div>

              <p className="text-xs font-semibold text-foreground/90 mt-1 truncate">
                {match.homeTeam.name}{' '}
                <span className="text-muted-foreground font-normal">vs.</span>{' '}
                {match.guestTeam.name}
              </p>

              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge variant="league" className="text-[10px]">
                  <Trophy className="mr-1 h-2.5 w-2.5" />
                  {leagueName}
                </Badge>

                <Badge variant="kickoff" className="text-[10px]">
                  <Clock className="mr-1 h-2.5 w-2.5" />
                  {formatDisplayDate(match.kickoffDate)} •{' '}
                  {formatKickoffTime(match.kickoffTime)} Uhr
                </Badge>

                {match.matchDay > 0 && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {match.matchDay}. Spieltag
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-top-match-modal"
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground shrink-0 ml-2"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Dialog Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
          {isAlgorithm && algorithmMeta ? (
            <>
              {/* Total Score Badge */}
              <div
                data-testid="top-match-score-card"
                className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-3.5 shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Gesamtbewertung
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Objektiver Relevanz-Score
                    </div>
                  </div>
                </div>

                <div
                  data-testid="top-match-total-score"
                  className="font-mono text-base sm:text-lg font-bold text-amber-700 dark:text-amber-300 drop-shadow-xs"
                >
                  Score: <span data-testid="top-match-score">{algorithmMeta.score}</span> Punkte
                </div>
              </div>

              {/* Factors Breakdown */}
              {algorithmMeta.factors && algorithmMeta.factors.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Berechnungsfaktoren ({algorithmMeta.factors.length})
                    </span>
                    <span className="text-[11px] text-muted-foreground">Punkte</span>
                  </div>

                  <div className="space-y-1.5" data-testid="top-match-factors-list">
                    {algorithmMeta.factors.map((factor, index) => (
                      <div
                        key={index}
                        data-testid={`top-match-factor-${index}`}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-2.5 transition hover:bg-muted/20"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="text-xs font-semibold text-foreground">
                            {factor.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground leading-snug">
                            {factor.description}
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="shrink-0 font-mono text-[11px] font-bold border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        >
                          {factor.points > 0 ? `+${factor.points} Pkt` : `${factor.points} Pkt`}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Calculation Formula Note */}
              <div
                data-testid="top-match-formula-explainer"
                className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/30 p-2.5 text-[11px] leading-relaxed text-muted-foreground"
              >
                <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  Berechnet auf Basis von Ligatabellen-Platzierung, Tabellennachbarschaft und Derby-Distanz via Hallen-Koordinaten.
                </span>
              </div>
            </>
          ) : isAdmin ? (
            /* Admin Selection Card */
            <div
              data-testid="top-match-admin-section"
              className="flex items-start gap-3 rounded-xl border border-sky-500/40 bg-sky-500/10 p-3.5 text-xs text-sky-900 dark:text-sky-200"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/20 text-sky-600 dark:text-sky-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="font-semibold text-sky-800 dark:text-sky-300 text-sm leading-tight">
                  Redaktioneller Tipp
                </div>

                <p className="text-[11px] text-sky-900/90 dark:text-sky-100 leading-relaxed">
                  Dieses Spiel wurde von der Redaktion / Turnierleitung manuell als Highlight des Tages ausgewählt.
                </p>

                {match.featuredUntil && (
                  <p className="text-[10px] text-sky-700 dark:text-sky-300/80 font-mono pt-0.5">
                    ⭐ Aktiv bis {formatDisplayDate(match.featuredUntil)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Fallback Information Card */
            <div
              data-testid="top-match-fallback-notice"
              className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-300">
                <Info className="h-4 w-4" />
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <div className="font-semibold text-amber-800 dark:text-amber-300 text-sm leading-tight">
                  Topspiel-Information
                </div>

                <p className="text-[11px] text-amber-900/90 dark:text-amber-100 leading-relaxed">
                  {match.featuredReason ||
                    'Dieses Spiel wurde als Spiel des Tages / Derby-Tipp hervorgehoben.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-border/60 bg-card/40 p-3 sm:p-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            data-testid="top-match-modal-close-button"
          >
            Schließen
          </Button>
        </div>
      </div>
    </div>
  );
}
