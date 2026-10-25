import * as React from 'react';
import {
  Check,
  Clock,
  List,
  Map as MapIcon,
  Server,
  Settings,
  X,
} from 'lucide-react';
import type { MapEngineType } from '@/components/map/map-engine.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatLastSyncedAt } from '@/lib/date-utils';

export interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mapEngine: MapEngineType;
  onEngineChange: (engine: MapEngineType) => void;
  showRadiusCircle: boolean;
  onToggleRadiusCircle: (show: boolean) => void;
  viewMode: 'map' | 'list';
  onViewModeChange: (mode: 'map' | 'list') => void;
  lastSyncedAt: string | null;
  matchCount: number;
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

export function SettingsDialog({
  isOpen,
  onClose,
  mapEngine,
  onEngineChange,
  showRadiusCircle,
  onToggleRadiusCircle,
  viewMode,
  onViewModeChange,
  lastSyncedAt,
  matchCount,
}: SettingsDialogProps) {
  // ESC key to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overscroll-contain"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Dialog Card */}
      <div className="relative z-10 flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col rounded-2xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150 overflow-hidden">
        {/* Sticky Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-4 sm:p-5 pb-3 bg-card/40">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card">
              <Settings className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2
                id="settings-dialog-title"
                className="text-base font-bold text-foreground leading-none"
              >
                Einstellungen & Optionen
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Karten-Technologie, Ansichten und System-Status
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Dialog Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pt-3 space-y-4 overscroll-contain">
          {/* Section 1: Ansichtsmodus (Karte vs. Liste) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Hauptansicht
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onViewModeChange('map')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  viewMode === 'map'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/80 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <MapIcon className="h-4 w-4" />
                <span>Kartenansicht</span>
              </button>

              <button
                type="button"
                onClick={() => onViewModeChange('list')}
                className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                  viewMode === 'list'
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-border/80 bg-card/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <List className="h-4 w-4" />
                <span>Listenansicht ({matchCount})</span>
              </button>
            </div>
          </div>

          {/* Section 2: Karten-Technologie (Map Spike Selector) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Karten-Engine (ADR-0002)
              </label>
              <Badge variant="outline" className="text-[10px] font-mono">
                {mapEngine}
              </Badge>
            </div>

            <div className="space-y-1.5">
              {MAP_ENGINES.map((engine) => {
                const isSelected = mapEngine === engine.id;

                return (
                  <button
                    key={engine.id}
                    type="button"
                    onClick={() => onEngineChange(engine.id)}
                    className={`flex w-full items-center justify-between rounded-xl border p-2.5 text-left transition ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
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
                      <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                        {engine.tagline}
                      </p>
                    </div>

                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
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

          {/* Section 3: Karten-Optionen */}
          <div className="space-y-2 border-t border-border/50 pt-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Karten-Darstellung
            </label>
            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-foreground block">
                  Suchradius-Kreis visualisieren
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Zeigt den Radius um den aktuellen Suchstandort
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
          </div>

          {/* Section 4: System & DBB-Datenstand */}
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs space-y-1.5">
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
                Server & API:
              </span>
              <span className="flex items-center gap-1 font-mono text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="shrink-0 border-t border-border/60 p-3 sm:p-4 bg-background/95">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onClose}
            className="w-full font-bold"
          >
            Fertig
          </Button>
        </div>
      </div>
    </div>
  );
}
