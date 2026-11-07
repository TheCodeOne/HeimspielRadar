import * as React from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  Layers,
  Monitor,
  RefreshCw,
  Server,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  formatIsoTimestamp,
  formatUptime,
  getCommitUrl,
  isGitSha,
  RELEASES_URL,
} from '@/lib/debug-formatters';
import { formatLastSyncedAt } from '@/lib/date-utils';
import { getMasterPoolStats } from '@/lib/use-matches';
import { useServerHealth } from '@/lib/use-server-health';
import { useTheme } from '@/hooks';

export interface SystemDiagnosticsSectionProps {
  mapEngine?: string;
  radiusKm?: number;
  locationName?: string;
  masterPoolCount?: number;
  filteredMatchesCount?: number;
  lastSyncedAt?: string | null;
  className?: string;
}

export function SystemDiagnosticsSection({
  mapEngine = 'openlayers',
  radiusKm = 50,
  locationName,
  masterPoolCount,
  filteredMatchesCount,
  lastSyncedAt: propLastSyncedAt,
  className = '',
}: SystemDiagnosticsSectionProps) {
  const { health, latencyMs, lastSyncedAt: apiLastSyncedAt, refetch } = useServerHealth();
  const { theme, resolvedTheme } = useTheme();

  const [copied, setCopied] = React.useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [viewport, setViewport] = React.useState<{ width: number; height: number }>(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }

    return { width: 1280, height: 800 };
  });

  const [swStatus, setSwStatus] = React.useState<string>('Inaktiv');

  // Monitor network status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor viewport resize
  React.useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Detect Service Worker state
  React.useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setSwStatus('Nicht unterstützt');

      return;
    }

    if (navigator.serviceWorker.controller) {
      setSwStatus('Aktiv');
    } else {
      setSwStatus('Inaktiv / Dev');
    }

    void navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg?.waiting) {
        setSwStatus('Update bereit');
      }
    });
  }, []);

  const frontendVersion = typeof __FRONTEND_VERSION__ !== 'undefined' ? __FRONTEND_VERSION__ : '0.1.0';
  const frontendSha = typeof __GIT_COMMIT_SHA__ !== 'undefined' ? __GIT_COMMIT_SHA__ : 'dev';
  const frontendBuiltAt = typeof __BUILD_TIMESTAMP__ !== 'undefined' ? __BUILD_TIMESTAMP__ : null;

  const backendVersion = health?.version ?? '–';
  const backendSha = health?.commitSha ?? '–';
  const backendBuiltAt = health?.builtAt ?? null;
  const backendUptimeSeconds = health?.uptimeSeconds ?? null;

  const isFrontendShaHex = isGitSha(frontendSha);
  const isBackendShaHex = isGitSha(backendSha);

  // Check for commit mismatch between Frontend and Backend (ignoring 'dev' or 'unknown')
  const hasCommitMismatch =
    isFrontendShaHex &&
    isBackendShaHex &&
    frontendSha.toLowerCase() !== backendSha.toLowerCase();

  // Resolve masterpool statistics
  const fallbackStats = getMasterPoolStats();
  const effectiveMasterPool = masterPoolCount ?? fallbackStats.masterPoolCount;
  const effectiveFiltered = filteredMatchesCount ?? fallbackStats.filteredMatchesCount;
  const effectiveLastSync = propLastSyncedAt ?? apiLastSyncedAt ?? health?.lastSyncedAt ?? null;

  // Resolve location source label
  const locationSource = React.useMemo(() => {
    if (!locationName || locationName === 'Stuttgart (Zentrum)') {
      return 'Standard';
    }

    if (locationName === 'Mein Standort') {
      return 'GPS';
    }

    return `Stadtsuche (${locationName})`;
  }, [locationName]);

  // Resolve theme mode
  const themeMode = React.useMemo(() => {
    if (theme === 'system') {
      return `system (${resolvedTheme})`;
    }

    return theme;
  }, [theme, resolvedTheme]);

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyDebugInfo = async () => {
    const markdown = [
      '### HeimspielRadar Diagnose & Systemstatus',
      `- **Frontend Version:** v${frontendVersion} (${frontendSha})`,
      `- **Backend Version:** v${backendVersion} (${backendSha})`,
      `- **Commit-Mismatch:** ${hasCommitMismatch ? 'JA (Abweichung vorhanden)' : 'Nein (Konsistent)'}`,
      `- **Frontend Built:** ${frontendBuiltAt || '–'}`,
      `- **Backend Built:** ${backendBuiltAt || '–'}`,
      `- **Backend Uptime:** ${backendUptimeSeconds != null ? formatUptime(backendUptimeSeconds) : '–'}`,
      `- **API-Ping-Latenz:** ${latencyMs != null ? `${latencyMs} ms` : '–'}`,
      `- **PWA Service Worker:** ${swStatus}`,
      `- **Netzwerkstatus:** ${isOnline ? 'Online' : 'Offline'}`,
      `- **Masterpool Cache:** ${effectiveMasterPool} Spiele im 50-km-Pool (${effectiveFiltered} aktuell gefiltert)`,
      `- **Letzter DBB-Sync:** ${formatLastSyncedAt(effectiveLastSync)}`,
      `- **Karten-Engine:** ${mapEngine}`,
      `- **Theme-Modus:** ${themeMode}`,
      `- **Viewport:** ${viewport.width} × ${viewport.height}`,
      `- **Standort-Quelle:** ${locationSource} (${radiusKm} km Radius)`,
      `- **User Agent:** ${typeof navigator !== 'undefined' ? navigator.userAgent : '–'}`,
      `- **Zeitstempel Report:** ${new Date().toISOString()}`,
    ].join('\n');

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(markdown);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch (err) {
      console.error('Fehler beim Kopieren der Diagnose-Infos:', err);
    }
  };

  return (
    <Card
      data-testid="system-diagnostics-section"
      className={`p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm ${className}`}
    >
      {/* Header with Title and Actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
            <Monitor className="h-4 w-4 text-primary" />
            System & Diagnose
          </h2>
          <p className="text-xs text-muted-foreground">
            Laufzeit-Statistiken, Versionsstände, PWA-Cache und Client-Kontext.
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Diagnose aktualisieren"
            aria-label="Diagnosedaten aktualisieren"
            className="h-8 px-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            type="button"
            variant={copied ? 'default' : 'secondary'}
            size="sm"
            onClick={handleCopyDebugInfo}
            data-testid="copy-debug-info-button"
            className="h-8 text-xs font-medium gap-1.5"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-300" />
                <span>Kopiert!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Debug-Info kopieren</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Mismatch Warning Alert */}
      {hasCommitMismatch && (
        <div
          data-testid="commit-mismatch-warning"
          role="alert"
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-300">
              Version-Mismatch erkannt
            </div>
            <div className="text-[11px] leading-relaxed text-amber-200/90">
              Frontend (<span className="font-mono">{frontendSha}</span>) und Backend (<span className="font-mono">{backendSha}</span>) basieren auf unterschiedlichen Git-Commits. Falls Änderungen nicht sichtbar sind, leere bitte den PWA-Cache.
            </div>
          </div>
        </div>
      )}

      {/* Grid: 4 Diagnostic Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* Category 1: Versionen & Commit-SHAs */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              Versionen & Commits
            </span>

            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline inline-flex items-center gap-1"
            >
              <span>Releases</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>

          {/* Frontend Version & SHA */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Frontend:</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-foreground">v{frontendVersion}</span>
              {isFrontendShaHex ? (
                <a
                  href={getCommitUrl(frontendSha)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="frontend-commit-link"
                  className="rounded bg-muted px-1.5 py-0.5 text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  <span>{frontendSha}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {frontendSha}
                </span>
              )}
            </div>
          </div>

          {/* Backend Version & SHA */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Backend:</span>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="text-foreground">v{backendVersion}</span>
              {isBackendShaHex ? (
                <a
                  href={getCommitUrl(backendSha)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="backend-commit-link"
                  className="rounded bg-muted px-1.5 py-0.5 text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  <span>{backendSha}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              ) : (
                <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                  {backendSha}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Category 2: Build- & Laufzeit-Infos */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5 text-primary" />
              Build & Laufzeit
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Frontend Built:</span>
            <span className="font-mono text-[11px] text-foreground">
              {formatIsoTimestamp(frontendBuiltAt)}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Backend Uptime:</span>
            <span className="font-mono text-[11px] text-foreground">
              {backendUptimeSeconds != null ? formatUptime(backendUptimeSeconds) : '–'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API Ping-Latenz:</span>
            <span
              data-testid="api-latency-display"
              className={`font-mono text-[11px] font-medium ${
                latencyMs == null
                  ? 'text-muted-foreground'
                  : latencyMs < 100
                  ? 'text-emerald-400'
                  : latencyMs < 300
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {latencyMs != null ? `${latencyMs} ms` : '–'}
            </span>
          </div>
        </div>

        {/* Category 3: PWA & Daten-Pool Status */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              PWA & Daten-Pool
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Service Worker:</span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${
                swStatus === 'Aktiv'
                  ? 'border-emerald-500/40 text-emerald-400'
                  : swStatus === 'Update bereit'
                  ? 'border-amber-500/40 text-amber-300'
                  : 'border-muted text-muted-foreground'
              }`}
            >
              {swStatus}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Netzwerk:</span>
            <span
              className={`inline-flex items-center gap-1 font-medium ${
                isOnline ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span>Offline</span>
                </>
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Masterpool (50 km):</span>
            <span className="font-mono text-[11px] text-foreground">
              {effectiveMasterPool} Spiele ({effectiveFiltered} gefiltert)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary" />
              DBB Sync:
            </span>
            <span className="font-mono text-[11px] text-foreground">
              {formatLastSyncedAt(effectiveLastSync)}
            </span>
          </div>
        </div>

        {/* Category 4: Client-Kontext */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3 space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <Monitor className="h-3.5 w-3.5 text-primary" />
              Client-Kontext
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Karten-Engine:</span>
            <Badge variant="outline" className="font-mono text-[10px] capitalize">
              {mapEngine}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Theme-Modus:</span>
            <span className="font-mono text-[11px] text-foreground capitalize">
              {themeMode}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Viewport:</span>
            <span className="font-mono text-[11px] text-foreground">
              {viewport.width} × {viewport.height}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Standort / Radius:</span>
            <span className="font-mono text-[11px] text-foreground truncate max-w-[140px] text-right">
              {locationSource} ({radiusKm} km)
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
