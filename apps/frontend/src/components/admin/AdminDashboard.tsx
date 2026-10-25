import * as React from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  RefreshCw,
  Send,
  ShieldAlert,
  Terminal,
  XCircle,
  Zap,
} from 'lucide-react';
import type {
  AdminStatusResponse,
  SyncFailure,
  SyncRun,
} from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }

  parts.push(`${minutes}m`);

  return parts.join(' ');
}

function formatDateTime(dateVal: string | Date | null | undefined): string {
  if (!dateVal) {
    return '–';
  }

  const d = new Date(dateVal);

  return new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) {
    return '–';
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function AdminDashboard() {
  const [status, setStatus] = React.useState<AdminStatusResponse | null>(null);
  const [syncRuns, setSyncRuns] = React.useState<SyncRun[]>([]);
  const [failures, setFailures] = React.useState<SyncFailure[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);

  // Sync trigger form state
  const [selectedTarget, setSelectedTarget] = React.useState<string>('verband:1');
  const [customLeagueId, setCustomLeagueId] = React.useState<string>('');
  const [syncType, setSyncType] = React.useState<'delta' | 'deep'>('delta');
  const [isTriggering, setIsTriggering] = React.useState<boolean>(false);

  // Action states
  const [isRetrying, setIsRetrying] = React.useState<boolean>(false);
  const [isTestingTelegram, setIsTestingTelegram] = React.useState<boolean>(false);

  const [feedbackMessage, setFeedbackMessage] = React.useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const clearFeedbackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFeedback = React.useCallback(
    (type: 'success' | 'error' | 'info', text: string) => {
      if (clearFeedbackTimerRef.current) {
        clearTimeout(clearFeedbackTimerRef.current);
      }

      setFeedbackMessage({ type, text });
      clearFeedbackTimerRef.current = setTimeout(() => {
        setFeedbackMessage(null);
      }, 6000);
    },
    []
  );

  const fetchData = React.useCallback(
    async (showInitialSpinner = false) => {
      if (showInitialSpinner) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const [statusRes, runsRes, failuresRes] = await Promise.all([
          fetch('/api/admin/status'),
          fetch('/api/admin/sync-runs?limit=20'),
          fetch('/api/admin/failures'),
        ]);

        if (statusRes.ok) {
          // SAFETY: /api/admin/status returns AdminStatusResponse
          const data = (await statusRes.json()) as AdminStatusResponse;
          setStatus(data);
        }

        if (runsRes.ok) {
          // SAFETY: /api/admin/sync-runs returns SyncRun[]
          const runsData = (await runsRes.json()) as SyncRun[];
          setSyncRuns(runsData);
        }

        if (failuresRes.ok) {
          // SAFETY: /api/admin/failures returns SyncFailure[]
          const failuresData = (await failuresRes.json()) as SyncFailure[];
          setFailures(failuresData);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        showFeedback('error', `Fehler beim Laden der Admin-Daten: ${msg}`);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [showFeedback]
  );

  // Initial fetch
  React.useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Adaptive polling: 3s while any sync run is running, 15s during idle
  const isSyncActive =
    status?.activeSyncRun != null ||
    syncRuns.some((run) => run.status === 'running');

  const pollIntervalMs = isSyncActive ? 3000 : 15000;

  React.useEffect(() => {
    const timer = setInterval(() => {
      fetchData(false);
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [fetchData, pollIntervalMs]);

  // Handle Trigger Sync
  const handleTriggerSync = async () => {
    let target = selectedTarget;

    if (target === 'custom') {
      const trimmed = customLeagueId.trim();

      if (!trimmed || isNaN(parseInt(trimmed, 10))) {
        showFeedback('error', 'Bitte eine gültige numerische Liga-ID eingeben.');

        return;
      }

      target = `league:${trimmed}`;
    }

    setIsTriggering(true);

    try {
      const res = await fetch('/api/admin/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: syncType, target }),
      });

      if (res.status === 409) {
        // SAFETY: Conflict response returns { message: string }
        const data = (await res.json()) as { message?: string };
        showFeedback('error', data.message || 'Ein Sync-Vorgang läuft bereits!');

        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      showFeedback('success', `Sync für "${target}" erfolgreich im Hintergrund gestartet.`);
      await fetchData(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Starten des Syncs: ${msg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  // Handle Retry Failed
  const handleRetryFailed = async () => {
    setIsRetrying(true);

    try {
      const res = await fetch('/api/admin/failures/retry', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      // SAFETY: retry returns RetryFailedResult
      const result = (await res.json()) as {
        retriedCount?: number;
        resolvedCount?: number;
        stillFailingCount?: number;
      };

      showFeedback(
        'success',
        `Wiederholung abgeschlossen: ${result.resolvedCount ?? 0} behoben, ${result.stillFailingCount ?? 0} weiterhin offen.`
      );
      await fetchData(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Fehler beim Wiederholen der Fehler: ${msg}`);
    } finally {
      setIsRetrying(false);
    }
  };

  // Handle Telegram Test
  const handleTelegramTest = async () => {
    setIsTestingTelegram(true);

    try {
      const res = await fetch('/api/admin/telegram/test', {
        method: 'POST',
      });

      // SAFETY: test endpoint returns { success: boolean, message?: string }
      const data = (await res.json()) as { success: boolean; message?: string };

      if (data.success) {
        showFeedback('success', 'Telegram Testnachricht erfolgreich versendet!');
      } else {
        showFeedback('error', `Telegram Fehler: ${data.message || 'Unbekannt'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showFeedback('error', `Telegram Test fehlgeschlagen: ${msg}`);
    } finally {
      setIsTestingTelegram(false);
    }
  };

  if (isLoading && !status) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">
            Lade HeimspielRadar Admin-Metriken...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-y-auto bg-background text-foreground">
      {/* Header Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Activity className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                HeimspielRadar Pi Admin
              </h1>
              <Badge variant="outline" className="font-mono text-[10px]">
                /admin
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Raspberry Pi Scraper & Observability Dashboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:flex">
            <span
              className={`size-2 rounded-full ${
                isSyncActive
                  ? 'animate-pulse bg-amber-400'
                  : 'bg-emerald-400'
              }`}
            />
            <span>{isSyncActive ? 'Sync aktiv (3s)' : 'Bereit (15s)'}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Aktualisieren</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 space-y-6 p-4 sm:p-6">
        {/* Feedback Alert */}
        {feedbackMessage && (
          <div
            className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm transition-all ${
              feedbackMessage.type === 'success'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : feedbackMessage.type === 'error'
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-blue-500/30 bg-blue-500/10 text-blue-400'
            }`}
          >
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : feedbackMessage.type === 'error' ? (
              <XCircle className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span className="flex-1 font-medium">{feedbackMessage.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Schließen
            </button>
          </div>
        )}

        {/* System Status Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Uptime Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Systemlaufzeit
              </CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {status ? formatUptime(status.uptimeSeconds) : '–'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Node.js {status?.nodeVersion || '–'}
              </p>
            </CardContent>
          </Card>

          {/* Memory Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Arbeitsspeicher (Heap)
              </CardTitle>
              <Cpu className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {status?.memory
                  ? `${status.memory.heapUsedMb} MB`
                  : '–'}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {status?.memory
                  ? `Heap Total: ${status.memory.heapTotalMb} MB • RSS: ${status.memory.rssMb} MB`
                  : '–'}
              </p>
            </CardContent>
          </Card>

          {/* Database Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Datenbank (PostgreSQL)
              </CardTitle>
              <Database className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    status?.databaseConnected
                      ? 'bg-emerald-400'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-xl font-bold">
                  {status?.databaseConnected ? 'Verbunden' : 'Getrennt'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                PostGIS Geodatenbank
              </p>
            </CardContent>
          </Card>

          {/* Telegram Alerting Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                Telegram Alerting
              </CardTitle>
              <Send className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span
                  className={`size-2.5 rounded-full ${
                    status?.telegramConfigured
                      ? 'bg-emerald-400'
                      : 'bg-muted-foreground'
                  }`}
                />
                <span className="text-xl font-bold">
                  {status?.telegramConfigured ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {status?.telegramConfigured
                  ? 'Live-Status & Push-Warnungen'
                  : 'Token / Chat-ID fehlen'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Action Bar */}
        <Card className="border-border/80 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Zap className="size-4 text-primary" />
              <span>Aktionen & Manuelle Synchronisation</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              {/* Target Selector */}
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Zielverband / Liga
                </label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="verband:1">
                    Verband 1 (Baden-Württemberg)
                  </option>
                  <option value="verband:31">
                    Verband 31 (Regionalliga Südwest)
                  </option>
                  <option value="all">
                    Alle aktiven Verbände (1..35)
                  </option>
                  <option value="custom">
                    Einzelne DBB Liga-ID...
                  </option>
                </select>
              </div>

              {/* Custom Liga-ID Input */}
              {selectedTarget === 'custom' && (
                <div className="w-full space-y-1.5 sm:w-48">
                  <label className="text-xs font-medium text-muted-foreground">
                    DBB Liga-ID
                  </label>
                  <input
                    type="number"
                    placeholder="z.B. 53941"
                    value={customLeagueId}
                    onChange={(e) => setCustomLeagueId(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              )}

              {/* Sync Type Selector */}
              <div className="w-full space-y-1.5 sm:w-56">
                <label className="text-xs font-medium text-muted-foreground">
                  Sync-Art
                </label>
                <select
                  value={syncType}
                  onChange={(e) => {
                    const val = e.target.value;

                    if (val === 'deep') {
                      setSyncType('deep');
                    } else {
                      setSyncType('delta');
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="delta">Delta-Sync (Schnell)</option>
                  <option value="deep">Vollständiger Sync (Tief)</option>
                </select>
              </div>

              {/* Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                <Button
                  onClick={handleTriggerSync}
                  disabled={isSyncActive || isTriggering}
                  className="gap-2 text-xs"
                >
                  {isSyncActive || isTriggering ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                  <span>{isSyncActive ? 'Sync läuft...' : 'Sync starten'}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRetryFailed}
                  disabled={isRetrying || failures.length === 0}
                  className="gap-2 text-xs"
                >
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span>Fehler wiederholen</span>
                  {failures.length > 0 && (
                    <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                      {failures.length}
                    </Badge>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleTelegramTest}
                  disabled={isTestingTelegram || !status?.telegramConfigured}
                  className="gap-2 text-xs"
                >
                  {isTestingTelegram ? (
                    <RefreshCw className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  <span>Telegram Test</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Failures Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                Aktive Fehler (sync_failures)
              </CardTitle>
              {failures.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[11px]">
                  {failures.length} offen
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {failures.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
                <CheckCircle2 className="size-8 text-emerald-500/60" />
                <p className="mt-2 text-xs font-medium">
                  Keine offenen Synchronisationsfehler. Alles läuft einwandfrei!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Typ</th>
                      <th className="py-2 pr-4 font-medium">Liga / Match</th>
                      <th className="py-2 pr-4 font-medium">Fehlermeldung</th>
                      <th className="py-2 pr-4 font-medium">Versuche</th>
                      <th className="py-2 font-medium">Zeitpunkt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {failures.map((f) => (
                      <tr key={f.id} className="hover:bg-accent/40">
                        <td className="py-2.5 pr-4 font-mono font-medium">
                          <Badge variant="outline" className="text-[10px]">
                            {f.entityType}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {f.leagueName ? (
                            <span>
                              {f.leagueName}{' '}
                              <span className="font-mono text-muted-foreground">
                                (#{f.dbbLeagueId})
                              </span>
                            </span>
                          ) : (
                            <span className="font-mono">#{f.dbbLeagueId}</span>
                          )}
                          {f.dbbMatchId && (
                            <span className="ml-1.5 font-mono text-muted-foreground">
                              Spiel #{f.dbbMatchId}
                            </span>
                          )}
                        </td>
                        <td className="max-w-xs truncate py-2.5 pr-4 text-rose-400" title={f.errorMessage}>
                          {f.errorMessage}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {f.retryCount}
                        </td>
                        <td className="py-2.5 font-mono text-muted-foreground">
                          {formatDateTime(f.failedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sync Runs Section */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="size-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Sync-Protokoll (sync_runs)
              </CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              Letzte {syncRuns.length} Ausführungen
            </span>
          </CardHeader>
          <CardContent>
            {syncRuns.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Noch keine protokollierten Sync-Läufe vorhanden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Ziel</th>
                      <th className="py-2 pr-4 font-medium">Typ</th>
                      <th className="py-2 pr-4 font-medium">Startzeit</th>
                      <th className="py-2 pr-4 font-medium">Dauer</th>
                      <th className="py-2 pr-4 font-medium">Ligen (OK / Ges.)</th>
                      <th className="py-2 pr-4 font-medium">Spiele</th>
                      <th className="py-2 pr-4 font-medium">Venues</th>
                      <th className="py-2 font-medium">Fehler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {syncRuns.map((run) => (
                      <tr key={run.id} className="hover:bg-accent/40">
                        <td className="py-2.5 pr-4">
                          {run.status === 'running' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 animate-pulse">
                              <span className="size-1.5 rounded-full bg-amber-400" />
                              running
                            </span>
                          ) : run.status === 'success' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <CheckCircle2 className="size-2.5" />
                              success
                            </span>
                          ) : run.status === 'partial' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              <AlertTriangle className="size-2.5" />
                              partial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
                              <XCircle className="size-2.5" />
                              error
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 font-medium">
                          {run.target === 'all'
                            ? 'Alle Verbände (1..35)'
                            : run.target === 'verband:1'
                              ? 'Verband 1 (BaWü)'
                              : run.target === 'verband:31'
                                ? 'Verband 31 (Regio SW)'
                                : run.target}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground uppercase text-[10px]">
                          {run.syncType}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                          {formatDateTime(run.startedAt)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {formatDuration(run.durationMs)}
                        </td>
                        <td className="py-2.5 pr-4 font-mono">
                          {run.successfulLeagues} / {run.totalLeagues}
                        </td>
                        <td className="py-2.5 pr-4 font-mono font-medium">
                          {run.syncedMatches}
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-muted-foreground">
                          {run.geocodedVenues}
                        </td>
                        <td className="py-2.5 font-mono">
                          {run.failuresCount > 0 ? (
                            <span className="font-semibold text-rose-400">
                              {run.failuresCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                          {run.errorMessage && (
                            <p className="mt-0.5 max-w-xs truncate text-[10px] text-rose-400" title={run.errorMessage}>
                              {run.errorMessage}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
