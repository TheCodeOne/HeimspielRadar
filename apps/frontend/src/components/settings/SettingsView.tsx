import * as React from 'react';
import {
  Bell,
  CalendarPlus,
  Check,
  Clock,
  Database,
  Download,
  ExternalLink,
  Laptop,
  List,
  Map as MapIcon,
  Moon,
  RotateCcw,
  Server,
  Settings,
  Share,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
} from 'lucide-react';
import { AppHeader } from '@/components/navigation/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDisplayDate, formatKickoffTime, formatLastSyncedAt } from '@/lib/date-utils';
import { getDonationUrl } from '@/lib/donation';
import { downloadReminderIcs } from '@/lib/ics-export';
import { useKioskQueue } from '@/lib/kiosk-submission-queue';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/lib/push-notification';
import { getLeadTimeLabel, useReminders } from '@/lib/reminder-storage';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { useTheme } from '@/hooks';
import { SystemDiagnosticsSection } from '@/components/settings/SystemDiagnosticsSection';

const DONATION_URL = getDonationUrl();

export interface SettingsViewProps {
  showRadiusCircle: boolean;
  onToggleRadiusCircle: (show: boolean) => void;
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
  lastSyncedAt: string | null;
  onNavigateHome: () => void;
  onBack: () => void;
  onOpenNav: () => void;
  radiusKm?: number;
  locationName?: string;
  masterPoolCount?: number;
  filteredMatchesCount?: number;
}

export function SettingsView({
  showRadiusCircle,
  onToggleRadiusCircle,
  viewMode,
  onViewModeChange,
  lastSyncedAt,
  onNavigateHome,
  onBack,
  onOpenNav,
  radiusKm = 50,
  locationName,
  masterPoolCount,
  filteredMatchesCount,
}: SettingsViewProps) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { reminders, removeReminder, clearAllReminders } = useReminders();
  const { isStandalone, canPromptInstall, isIosSafari, triggerInstall } = usePwaInstall();

  const {
    queue: offlineQueue,
    count: offlineQueueCount,
    syncQueue: syncOfflineQueue,
    isSyncing: isSyncingOfflineQueue,
    removeSubmission: removeOfflineSubmission,
  } = useKioskQueue();

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [isClearingCache, setIsClearingCache] = React.useState<boolean>(false);

  const [pushPermission, setPushPermission] = React.useState<NotificationPermission | 'unsupported'>(() => {
    return getNotificationPermission();
  });

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => setToastMessage(null), 4000);

    return () => clearTimeout(timer);
  }, []);

  const handleRequestPush = async () => {
    const res = await requestNotificationPermission();
    setPushPermission(res);

    if (res === 'granted') {
      showToast('Push-Benachrichtigungen erfolgreich erlaubt!');
    } else if (res === 'denied') {
      showToast('Benachrichtigungen wurden im Browser blockiert.');
    }
  };

  const handleSyncOfflineQueue = async () => {
    const result = await syncOfflineQueue();

    if (result.syncedCount > 0) {
      showToast(
        result.syncedCount === 1
          ? 'Ausstehende Kiosk-Info wurde erfolgreich übermittelt!'
          : `${result.syncedCount} ausstehende Kiosk-Infos wurden erfolgreich übermittelt!`,
      );
    } else if (result.failedCount > 0) {
      showToast('Synchronisierung fehlgeschlagen. Bitte prüfe deine Internetverbindung.');
    } else {
      showToast('Keine ausstehenden Meldungen zu synchronisieren.');
    }
  };

  const handleClearCacheAndStorage = async () => {
    setIsClearingCache(true);

    try {
      // 1. Delete PWA caches
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((k) => window.caches.delete(k)));
      }

      // 2. Clear relevant local storage items
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('heimspielradar_filters_v2');
      }

      showToast('Offline-Cache und Speicher erfolgreich geleert!');
    } catch (err) {
      console.error('Fehler beim Leeren des Caches:', err);
      showToast('Fehler beim Leeren des Caches.');
    } finally {
      setIsClearingCache(false);
    }
  };

  return (
    <div className="fixed inset-0 flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Global Unified App Header */}
      <AppHeader
        onOpenNav={onOpenNav}
        onNavigateHome={onNavigateHome}
        backLink={{
          label: 'Zurück',
          onClick: onBack,
        }}
        lastSyncedAt={lastSyncedAt}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 flex items-center gap-2 rounded-xl border border-border bg-card/95 text-card-foreground px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-foreground"
            aria-label="Toast schließen"
          >
            ✕
          </button>
        </div>
      )}

      {/* Scrollable Page Body */}
      <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-2xl w-full space-y-6 pb-16">
          {/* Page Title & Intro */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card">
                <Settings className="h-4 w-4 text-primary" />
              </div>

              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Einstellungen & Optionen
              </h1>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground">
              Karten-Technologie, Standardansicht, Push-Benachrichtigungen und Speicherverwaltung.
            </p>
          </div>

          {/* Section 1: Karten-Optionen */}
          <Card className="p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Karten-Optionen
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Visuelle Darstellungsoptionen für die interaktive Karte.
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-[10px]">
                MapLibre GL
              </Badge>
            </div>

            {/* Radius Circle Toggle */}
            <div className="border-t border-border/50 pt-3 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground block">
                  Suchradius-Kreis visualisieren
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Zeigt den Umkreis auf der interaktiven Karte als transparenten Kreis an.
                </span>
              </div>

              <button
                type="button"
                role="switch"
                aria-label="Suchradius auf Karte anzeigen"
                aria-checked={showRadiusCircle}
                onClick={() => onToggleRadiusCircle(!showRadiusCircle)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  showRadiusCircle ? 'bg-primary' : 'bg-muted'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    showRadiusCircle ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Section 2: Standard-Ansicht */}
          <Card className="p-4 sm:p-5 space-y-3 border-border/80 bg-card/60 backdrop-blur-sm">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Standard-Ansicht
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bestimme, welche Hauptansicht standardmäßig geladen wird.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onViewModeChange('map')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                  viewMode === 'map'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <MapIcon className="h-4 w-4" />
                <span>Kartenansicht</span>
              </button>

              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-xs font-semibold transition ${
                  viewMode === 'list'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <List className="h-4 w-4" />
                <span>Listenansicht</span>
              </button>
            </div>
          </Card>

          {/* Section 3: Erscheinungsbild (Theme Switcher) */}
          <Card className="p-4 sm:p-5 space-y-3 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  Erscheinungsbild
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wähle zwischen Geräte-Einstellung (System), hellem oder dunklem Farbschema.
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-[10px]">
                {theme === 'system'
                  ? `System (${resolvedTheme === 'dark' ? 'Dunkel' : 'Hell'})`
                  : theme === 'dark'
                  ? 'Dunkel'
                  : 'Hell'}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Farbschema auswählen">
              <button
                type="button"
                role="radio"
                aria-checked={theme === 'system'}
                data-testid="theme-system"
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                  theme === 'system'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Laptop className="h-4 w-4" />
                <span>System</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={theme === 'light'}
                data-testid="theme-light"
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                  theme === 'light'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span>Hell</span>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={theme === 'dark'}
                data-testid="theme-dark"
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-semibold transition ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/60 bg-background/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span>Dunkel</span>
              </button>
            </div>
          </Card>

          {/* Section 3: Push-Benachrichtigungen & Spiel-Erinnerungen */}
          <Card className="p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Bell className="h-4 w-4 text-primary" />
                  Push-Benachrichtigungen & Erinnerungen
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Erhalte Tip-off Benachrichtigungen für gespeicherte Spiele.
                </p>
              </div>

              <Badge
                variant={pushPermission === 'granted' ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {pushPermission === 'granted'
                  ? 'Aktiviert'
                  : pushPermission === 'denied'
                  ? 'Blockiert'
                  : 'Nicht aktiv'}
              </Badge>
            </div>

            {/* Permission Control */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-semibold text-foreground block">
                  Web-Push Status
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {pushPermission === 'granted'
                    ? 'Browser-Benachrichtigungen sind freigeschaltet.'
                    : pushPermission === 'denied'
                    ? 'Benachrichtigungen wurden blockiert. Bitte in den Browser-Website-Einstellungen ändern.'
                    : 'Noch keine Berechtigung für Benachrichtigungen erteilt.'}
                </span>
              </div>

              {pushPermission !== 'granted' && isNotificationSupported() && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestPush}
                  className="shrink-0 text-xs font-medium"
                >
                  <Bell className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Aktivieren
                </Button>
              )}
            </div>

            {/* Aktive Spiel-Erinnerungen Subsection */}
            <div className="space-y-2 border-t border-border/50 pt-3" data-testid="settings-reminders-section">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Aktive Spiel-Erinnerungen ({reminders.length})
                </label>

                <Badge
                  variant="secondary"
                  className={`text-[10px] px-2 py-0 ${
                    reminders.length > 0
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : 'text-muted-foreground'
                  }`}
                >
                  {reminders.length} {reminders.length === 1 ? 'aktiv' : 'aktiv'}
                </Badge>
              </div>

              {reminders.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs text-muted-foreground">
                  <p>Keine aktiven Spiel-Erinnerungen vorhanden.</p>
                  <p className="text-[11px] mt-1 text-muted-foreground/80">
                    Klicke auf das Glocken-Symbol auf einer Spielkarte, um eine Erinnerung zu setzen.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-2">
                    {reminders.map((r) => (
                      <div
                        key={r.matchId}
                        data-testid={`settings-reminder-${r.matchId}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/50 p-2.5 text-xs"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-semibold text-foreground truncate">
                            {r.homeTeamName} vs. {r.guestTeamName}
                          </div>

                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap">
                            <span>
                              {formatDisplayDate(r.kickoffDate)} • {formatKickoffTime(r.kickoffTime)}
                            </span>
                            <span className="inline-flex items-center rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0 text-[10px] font-mono text-amber-700 dark:text-amber-300">
                              {getLeadTimeLabel(r.leadTime)}
                            </span>
                          </div>

                          {r.venueName && (
                            <div className="text-[10px] text-muted-foreground/80 truncate">
                              {r.venueName}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="In Kalender exportieren (.ics)"
                            aria-label={`Kalenderdatei für ${r.homeTeamName} gegen ${r.guestTeamName} herunterladen`}
                            onClick={() => downloadReminderIcs(r)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition cursor-pointer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            title="Erinnerung entfernen"
                            aria-label={`Erinnerung für ${r.homeTeamName} gegen ${r.guestTeamName} entfernen`}
                            onClick={() => removeReminder(r.matchId)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/15 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {reminders.length > 1 && (
                    <button
                      type="button"
                      onClick={clearAllReminders}
                      className="w-full rounded-lg border border-destructive/30 bg-destructive/10 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/20 transition cursor-pointer"
                    >
                      Alle Erinnerungen entfernen
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Section 4: Speicher & Offline-Cache */}
          <Card className="p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-primary" />
                  Speicher & Offline-Cache
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PWA-Service Worker Cache und lokale Filter-Einstellungen verwalten.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-semibold text-foreground block">
                  Cache & Offline-Speicher leeren
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Löscht zwischengespeicherte DBB-Spiele, Kartenkacheln und Filter-Einstellungen.
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearCacheAndStorage}
                disabled={isClearingCache}
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                <span>{isClearingCache ? 'Wird geleert...' : 'Cache leeren'}</span>
              </Button>
            </div>

            {/* Subsection: Ausstehende Offline-Meldungen */}
            <div
              data-testid="settings-offline-queue-section"
              className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground block">
                      Ausstehende Offline-Meldungen
                    </span>
                    <Badge
                      variant="secondary"
                      data-testid="offline-queue-count-badge"
                      className="text-[10px] font-mono px-1.5 py-0"
                    >
                      {offlineQueueCount}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    Kiosk- & Halleninfos, die offline erfasst wurden und automatisch synchronisiert werden.
                  </span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  data-testid="sync-offline-queue-button"
                  onClick={handleSyncOfflineQueue}
                  disabled={offlineQueueCount === 0 || isSyncingOfflineQueue}
                  className="shrink-0 text-xs h-8"
                >
                  <RotateCcw
                    className={`mr-1.5 h-3.5 w-3.5 ${isSyncingOfflineQueue ? 'animate-spin' : ''}`}
                  />
                  <span>
                    {isSyncingOfflineQueue ? 'Wird synchronisiert...' : 'Jetzt synchronisieren'}
                  </span>
                </Button>
              </div>

              {offlineQueueCount === 0 ? (
                <div
                  data-testid="offline-queue-empty-state"
                  className="rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground"
                >
                  Keine ausstehenden Offline-Meldungen vorhanden. Alle Kiosk- und Hallen-Infos sind synchronisiert.
                </div>
              ) : (
                <div className="space-y-2 pt-1" data-testid="offline-queue-list">
                  {offlineQueue.map((item) => (
                    <div
                      key={item.matchId}
                      data-testid="offline-queue-item"
                      className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-card/60 p-2.5 text-xs"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-semibold text-foreground truncate">
                          {item.matchTitle}
                        </div>

                        {item.venueName && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            📍 {item.venueName}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-1.5 pt-0.5 text-[10px]">
                          {item.payload.admissionFee && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              🎟️ {item.payload.admissionFee}
                            </span>
                          )}

                          {item.payload.kioskDescription && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              ☕ {item.payload.kioskDescription}
                            </span>
                          )}

                          {item.payload.parkingNotes && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                              🅿️ {item.payload.parkingNotes}
                            </span>
                          )}

                          {item.retryCount > 0 && (
                            <span className="rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 px-1.5 py-0.5">
                              {item.retryCount} Fehlversuch{item.retryCount > 1 ? 'e' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-testid="discard-queue-item-button"
                        onClick={() => {
                          removeOfflineSubmission(item.matchId);
                          showToast('Offline-Meldung verworfen.');
                        }}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        title="Offline-Meldung verwerfen"
                        aria-label="Offline-Meldung verwerfen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Section: App installieren / App-Status */}
          <Card
            data-testid="settings-pwa-install-section"
            className="p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-primary" />
                  App-Status & Installation
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  HeimspielRadar als native Web-App auf dem Homescreen nutzen.
                </p>
              </div>

              <Badge
                variant={isStandalone ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {isStandalone ? 'Als App installiert ✓' : 'Web-Modus'}
              </Badge>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              {isStandalone ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                    <Check className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">
                      Als App installiert ✓
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      HeimspielRadar läuft im Vollbildmodus direkt von deinem Homescreen.
                    </span>
                  </div>
                </div>
              ) : canPromptInstall ? (
                <>
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      HeimspielRadar installieren
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Installiere die App auf deinem Gerät für schnellen Zugriff und Offline-Nutzung.
                    </span>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    data-testid="settings-pwa-install-btn"
                    onClick={() => triggerInstall()}
                    className="shrink-0 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>App installieren</span>
                  </Button>
                </>
              ) : isIosSafari ? (
                <div className="space-y-2 w-full">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-foreground block">
                      Auf iOS installieren
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Tippe in der Safari-Menüleiste auf <strong className="text-foreground">Teilen</strong>{' '}
                      und wähle <strong className="text-foreground">Zum Home-Bildschirm</strong>.
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    <Share className="h-3.5 w-3.5 shrink-0" />
                    <span>Teilen ➔ Zum Home-Bildschirm</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <span className="font-semibold text-foreground block">
                    Installation im Browser
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Nutze das Browser-Menü deines Geräts, um HeimspielRadar zum Startbildschirm hinzuzufügen.
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Section 5: System & Diagnose */}
          <SystemDiagnosticsSection
            mapEngine="MapLibre GL"
            radiusKm={radiusKm}
            locationName={locationName}
            masterPoolCount={masterPoolCount}
            filteredMatchesCount={filteredMatchesCount}
            lastSyncedAt={lastSyncedAt}
          />

          {/* Section 6: Über & DBB-Sync */}
          <Card className="p-4 sm:p-5 space-y-4 border-border/80 bg-card/60 backdrop-blur-sm">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Über & DBB-Sync
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Systemstatus, DBB-Schnittstelle und Projekt-Transparenz.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/50 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  Letzter DBB-Abgleich:
                </span>
                <span className="font-mono font-medium text-foreground">
                  {formatLastSyncedAt(lastSyncedAt)}
                </span>
              </div>

              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5 text-primary" />
                  Server & API Status:
                </span>
                <span className="flex items-center gap-1 font-mono text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Online
                </span>
              </div>
            </div>

            {/* Hallenkaffee Callout Box */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg leading-none" role="img" aria-hidden="true">
                  ☕
                </span>
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  Unterstütze HeimspielRadar mit einem Hallenkaffee
                </span>
              </div>

              <p className="text-[11px] text-amber-900/90 dark:text-amber-200/80 leading-relaxed">
                HeimspielRadar ist zu 100% gemeinnützig, werbefrei und quelloffen. Mit deiner Unterstützung hilfst du direkt, die laufenden Server- und Domainkosten zu decken.
              </p>

              <a
                href={DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200 transition hover:bg-amber-500/25"
              >
                <span>Hallenkaffee spendieren</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
