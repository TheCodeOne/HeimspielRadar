import * as React from 'react';
import {
  Activity,
  BarChart3,
  Check,
  FileText,
  Navigation,
  Share2,
  Trophy,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { getMatchLinks } from '@/lib/match-links';
import { shareMatch } from '@/lib/share-utils';

export interface MatchQuickActionsProps {
  match: Match;
  className?: string;
  size?: 'sm' | 'default';
  onShareFeedback?: (message: string) => void;
}

export const MatchQuickActions: React.FC<MatchQuickActionsProps> = ({
  match,
  className = '',
  size = 'default',
  onShareFeedback,
}) => {
  const [isCopied, setIsCopied] = React.useState(false);
  const links = getMatchLinks(match);
  const isFinished = Boolean(match.result);

  const iconSizeClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const buttonSizeClass = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const baseButtonClass = `inline-flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${buttonSizeClass}`;

  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const result = await shareMatch(match, {
      onSuccess: (type) => {
        if (type === 'copied') {
          setIsCopied(true);
          onShareFeedback?.('Link zum Spiel in die Zwischenablage kopiert!');
          setTimeout(() => setIsCopied(false), 2500);
        } else {
          onShareFeedback?.('Spiel geteilt!');
        }
      },
      onError: () => {
        onShareFeedback?.('Teilen fehlgeschlagen');
      },
    });

    if (result === 'copied' && !isCopied) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Match Quick-Actions"
      className={`inline-flex items-center gap-1 ${className}`}
      onClick={stopPropagation}
    >
      {/* 1. Hallen-Navigation */}
      {links.navigationUrl ? (
        <a
          href={links.navigationUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Hallen-Navigation (Google Maps)"
          aria-label="Hallen-Navigation öffnen"
          data-action="navigation"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          className={`${baseButtonClass} ${
            !isFinished
              ? 'border border-border/70 text-foreground hover:bg-primary/10 hover:text-primary'
              : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Navigation className={iconSizeClass} />
        </a>
      ) : (
        <span
          aria-disabled="true"
          title="Keine Hallenadresse verfügbar"
          aria-label="Hallen-Navigation nicht verfügbar"
          data-action="navigation-disabled"
          onClick={stopPropagation}
          className={`${baseButtonClass} border border-border/30 opacity-40 cursor-not-allowed text-muted-foreground`}
        >
          <Navigation className={iconSizeClass} />
        </span>
      )}

      {/* 2. DBB Spielinfo */}
      <a
        href={links.dbbMatchInfoUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="DBB Spielinfo & Aufstellung"
        aria-label="DBB Spielinfo öffnen"
        data-action="spielinfo"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        className={`${baseButtonClass} border border-border/70 text-foreground hover:bg-primary/10 hover:text-primary`}
      >
        <FileText className={iconSizeClass} />
      </a>

      {/* 3. DBB Boxscore */}
      <a
        href={links.dbbBoxscoreUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={
          isFinished
            ? 'DBB Boxscore & Spielerstatistiken'
            : 'Statistiken nach Spielbeginn verfügbar'
        }
        aria-label={
          isFinished
            ? 'DBB Boxscore & Spielerstatistiken öffnen'
            : 'DBB Boxscore (Statistiken nach Spielbeginn verfügbar)'
        }
        data-action="boxscore"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        className={`${baseButtonClass} ${
          isFinished
            ? 'border border-primary/40 bg-primary/10 text-primary font-semibold hover:bg-primary/20'
            : 'border border-transparent text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground'
        }`}
      >
        <BarChart3 className={iconSizeClass} />
      </a>

      {/* 4. DBB Live Play-by-Play */}
      <a
        href={links.dbbPlayByPlayUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={
          isFinished
            ? 'DBB Live-Ticker & Play-by-Play'
            : 'Live-Ticker nach Spielbeginn verfügbar'
        }
        aria-label={
          isFinished
            ? 'DBB Live-Ticker & Play-by-Play öffnen'
            : 'DBB Play-by-Play (Live-Ticker nach Spielbeginn verfügbar)'
        }
        data-action="playbyplay"
        onClick={stopPropagation}
        onKeyDown={stopPropagation}
        className={`${baseButtonClass} ${
          isFinished
            ? 'border border-primary/40 bg-primary/10 text-primary font-semibold hover:bg-primary/20'
            : 'border border-transparent text-muted-foreground/50 hover:bg-muted/40 hover:text-muted-foreground'
        }`}
      >
        <Activity className={iconSizeClass} />
      </a>

      {/* 5. DBB Ligatabelle & Spielplan */}
      {links.dbbStandingsUrl ? (
        <a
          href={links.dbbStandingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="DBB Tabelle & Spielplan"
          aria-label="DBB Tabelle öffnen"
          data-action="standings"
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          className={`${baseButtonClass} ${
            !isFinished
              ? 'border border-border/70 text-foreground hover:bg-primary/10 hover:text-primary'
              : 'border border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Trophy className={iconSizeClass} />
        </a>
      ) : (
        <span
          aria-disabled="true"
          title="Keine Ligatabelle verfügbar"
          aria-label="DBB Tabelle nicht verfügbar"
          data-action="standings-disabled"
          onClick={stopPropagation}
          className={`${baseButtonClass} border border-border/30 opacity-40 cursor-not-allowed text-muted-foreground`}
        >
          <Trophy className={iconSizeClass} />
        </span>
      )}

      {/* 6. Spiel teilen (Web Share API oder Zwischenablage) */}
      <button
        type="button"
        title={isCopied ? 'Link kopiert!' : 'Spiel teilen'}
        aria-label={isCopied ? 'Link zum Spiel kopiert' : 'Spiel teilen'}
        data-action="share"
        onClick={handleShare}
        className={`${baseButtonClass} ${
          isCopied
            ? 'border border-emerald-500/50 bg-emerald-500/20 text-emerald-400 font-semibold'
            : 'border border-border/70 text-foreground hover:bg-primary/10 hover:text-primary'
        }`}
      >
        {isCopied ? (
          <Check className={iconSizeClass} />
        ) : (
          <Share2 className={iconSizeClass} />
        )}
      </button>
    </div>
  );
};
