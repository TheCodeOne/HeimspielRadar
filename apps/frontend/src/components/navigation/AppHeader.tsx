import * as React from 'react';
import { ArrowLeft, Clock, Menu, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Button } from '@/components/ui/button';
import { formatLastSyncedAt } from '@/lib/date-utils';
import { getDonationUrl } from '@/lib/donation';

const DONATION_URL = getDonationUrl();

export interface AppHeaderProps {
  onOpenNav: () => void;
  onNavigateHome?: () => void;
  backLink?: {
    label: string;
    onClick: () => void;
  };
  lastSyncedAt?: string | null;
  isOnline?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function AppHeader({
  onOpenNav,
  onNavigateHome,
  backLink,
  lastSyncedAt,
  isOnline = true,
  children,
  className = '',
}: AppHeaderProps) {
  const handleHomeClick = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 flex h-14 h-safe-header shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/95 px-3 backdrop-blur-md sm:px-6 ${className}`}
    >
      {/* Left: Brand Logo, Title & Back/Context Navigation */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={handleHomeClick}
          className="flex items-center gap-2 text-left group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg p-0.5 shrink-0"
          aria-label="HeimspielRadar Startseite"
        >
          <BrandLogo className="h-8 w-8 shrink-0 rounded-lg shadow-xs transition group-hover:scale-105" />

          <span
            className={`font-bold tracking-tight text-base sm:text-lg text-foreground group-hover:text-primary transition-colors ${
              backLink ? 'hidden sm:inline' : ''
            }`}
          >
            HeimspielRadar
          </span>
        </button>

        {backLink && (
          <div className="flex items-center gap-1.5 ml-1 border-l border-border/60 pl-2 min-w-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={backLink.onClick}
              aria-label={backLink.label}
              className="h-8 gap-1.5 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground shrink-0"
            >
              {!backLink.label.includes('←') && <ArrowLeft className="h-3.5 w-3.5" />}
              <span>{backLink.label}</span>
            </Button>
          </div>
        )}

        {!backLink && (
          <>
            <Badge variant="outline" className="hidden text-[10px] lg:inline-flex">
              Amateur-Basketball
            </Badge>

            {lastSyncedAt && (
              <Badge
                variant="outline"
                className="hidden text-[10px] font-mono text-muted-foreground xl:inline-flex border-border/60 bg-muted/30"
                title={`Letzte DBB-Synchronisierung: ${lastSyncedAt}`}
              >
                <Clock className="mr-1 h-3 w-3 text-primary/70" />
                {formatLastSyncedAt(lastSyncedAt)}
              </Badge>
            )}

            {!isOnline && (
              <Badge
                variant="outline"
                data-testid="offline-badge"
                className="hidden md:inline-flex items-center gap-1.5 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium"
              >
                <WifiOff className="h-3 w-3 text-amber-500" />
                <span>Offline</span>
              </Badge>
            )}
          </>
        )}
      </div>

      {/* Right: Actions (Contextual children, Hallenkaffee & Hamburger Menu Button) */}
      <div className="flex items-center gap-2 shrink-0">
        {children}

        {/* Hallenkaffee Donation Link */}
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Hallenkaffee spendieren (Serverkosten unterstützen)"
          aria-label="Hallenkaffee spendieren (Serverkosten unterstützen)"
          className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <span className="text-sm leading-none" role="img" aria-hidden="true">
            ☕
          </span>
          <span className="hidden sm:inline">Hallenkaffee</span>
        </a>

        {/* Top-right menu trigger: Hamburger icon replacing settings gear */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onOpenNav}
          className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Menü öffnen"
          title="Navigation öffnen"
          data-testid="nav-menu-button"
        >
          <Menu className="h-4 w-4 text-foreground" />
        </Button>
      </div>
    </header>
  );
}
