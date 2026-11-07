import * as React from 'react';
import {
  Bell,
  CalendarPlus,
  Check,
  Clock,
  Database,
  ExternalLink,
  List,
  Map as MapIcon,
  RotateCcw,
  Server,
  Settings,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { MapEngineType } from '@/components/map/map-engine.types';
import { AppHeader } from '@/components/navigation/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDisplayDate, formatKickoffTime, formatLastSyncedAt } from '@/lib/date-utils';
import { getDonationUrl } from '@/lib/donation';
import { downloadReminderIcs } from '@/lib/ics-export';
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
} from '@/lib/push-notification';
import { getLeadTimeLabel, useReminders } from '@/lib/reminder-storage';

const DONATION_URL = getDonationUrl();

export interface SettingsViewProps {
  mapEngine: MapEngineType;
  onEngineChange: (engine: MapEngineType) => void;
  showRadiusCircle: boolean;
  onToggleRadiusCircle: (show: boolean) => void;
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
  lastSyncedAt: string | null;
  onNavigateHome: () => void;
  onBack: () => void;
  onOpenNav: () => void;
}

interface MapEngineOption {
  id: MapEngineType;
  title: string;
  tagline: string;
  badge?: string;
}

const MAP_ENGINES: MapEngineOption[] = [
  {
    id: 'openlayers',
    title: 'OpenLayers',
    tagline: 'Standard • Beste Vektordarstellung & Stabilität',
    badge: 'Empfohlen',
  },
  {
    id: 'maplibre',
    title: 'MapLibre GL',
    tagline: 'Hardwarebeschleunigte Vektorkarte & weiche Animationen',
  },
  {
    id: 'leaflet',
    title: 'Leaflet',
    tagline: 'Klassische, bewährte Rasterkarten-Bibliothek',
  },
  {
    id: 'pigeon',
    title: 'Pigeon Maps',
    tagline: 'Ultra-leichtgewichtige React-Only Map Engine',
  },
];

export function SettingsView({
  mapEngine,
  onEngineChange,
  showRadiusCircle,
  onToggleRadiusCircle,
  viewMode,
  onViewModeChange,
  lastSyncedAt,
  onNavigateHome,
  onBack,
  onOpenNav,
}: SettingsViewProps) {
  const { reminders, removeReminder, clearAllReminders } = useReminders();
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
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 flex items-center gap-2 rounded-xl border border-primary/40 bg-slate-900/95 text-slate-100 px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
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
                  Karten-Optionen (ADR-0002)
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Wähle deine bevorzugte Karten-Engine und visuelle Darstellungsoptionen.
                </p>
              </div>

              <Badge variant="outline" className="font-mono text-[10px]">
                {mapEngine}
              </Badge>
            </div>

            {/* Map Engine Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Karten-Engine
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {MAP_ENGINES.map((engine) => {
                  const isSelected = mapEngine === engine.id;

                  return (
                    <button
                      key={engine.id}
                      type="button"
                      onClick={() => onEngineChange(engine.id)}
                      className={`flex items-start justify-between rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-primary bg-primary/10 text-foreground shadow-xs'
                          : 'border-border/60 bg-background/50 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">
                            {engine.title}
                          </span>
                          {engine.badge && (
                            <Badge
                              variant="secondary"
                              className="bg-primary/20 text-primary text-[9px] px-1.5 py-0"
                            >
                              {engine.badge}
                            </Badge>
                          )}
                        </div>

                        <p className="text-[11px] text-muted-foreground leading-tight mt-1">
                          {engine.tagline}
                        </p>
                      </div>

                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border mt-0.5 ${
                          isSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
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
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
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
                            <span className="inline-flex items-center rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0 text-[10px] font-mono text-amber-300">
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
          <Card className="p-4 sm:p-5 space-y-3 border-border/80 bg-card/60 backdrop-blur-sm">
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
          </Card>

          {/* Section 5: Über & DBB-Sync */}
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
                <span className="font-bold text-amber-300">
                  Unterstütze HeimspielRadar mit einem Hallenkaffee
                </span>
              </div>

              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                HeimspielRadar ist zu 100% gemeinnützig, werbefrei und quelloffen. Mit deiner Unterstützung hilfst du direkt, die laufenden Server- und Domainkosten zu decken.
              </p>

              <a
                href={DONATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/50 bg-amber-500/20 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/30"
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
