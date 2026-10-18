import * as React from 'react';
import {
  Calendar,
  Compass,
  Loader2,
  LocateFixed,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  formatLastSyncedAt,
  getThisWeekendSaturdayString,
  getTodayString,
  getTomorrowString,
} from '@/lib/date-utils';
import type { LocationReference } from '@/lib/geo-utils';

export interface FilterBarProps {
  selectedDate: string; // '' for all, or 'YYYY-MM-DD'
  onDateChange: (date: string) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  location: LocationReference;
  onLocationChange: (loc: LocationReference) => void;
  selectedLeagueId?: number; // undefined for all
  onLeagueChange: (leagueId?: number) => void;
  availableLeagues?: Array<{ id: number; name: string }>;
  onResetFilters?: () => void;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  lastSyncedAt?: string | null;
  className?: string;
}

export function FilterBar({
  selectedDate,
  onDateChange,
  radiusKm,
  onRadiusChange,
  location,
  onLocationChange,
  selectedLeagueId,
  onLeagueChange,
  availableLeagues = [
    { id: 1, name: 'Oberliga Württemberg' },
    { id: 2, name: 'Landesliga' },
  ],
  onResetFilters,
  onRequestLocation,
  isLocating = false,
  lastSyncedAt,
  className = '',
}: FilterBarProps) {
  const [internalLocating, setInternalLocating] = React.useState(false);

  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();
  const weekendStr = getThisWeekendSaturdayString();

  const handleGetCurrentLocation = () => {
    if (onRequestLocation) {
      onRequestLocation();

      return;
    }

    setInternalLocating(true);

    if (!navigator.geolocation) {
      onLocationChange({
        lat: 48.7758,
        lng: 9.1829,
        name: 'Stuttgart (Fallback)',
      });
      setInternalLocating(false);

      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lng = Math.round(pos.coords.longitude * 10000) / 10000;

        onLocationChange({
          lat,
          lng,
          name: 'Mein Standort',
        });
        setInternalLocating(false);
      },
      () => {
        // Fallback to Stuttgart coordinates
        onLocationChange({
          lat: 48.7758,
          lng: 9.1829,
          name: 'Stuttgart (Fallback)',
        });
        setInternalLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true },
    );
  };

  const isLocatingActive = isLocating || internalLocating;

  return (
    <div className={`space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:p-5 ${className}`}>
      {/* Location and Radius Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Standort & Umkreis
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGetCurrentLocation}
            disabled={isLocatingActive}
            className="h-7 text-xs font-medium"
            title="Eigenen Standort abfragen (Fallback: Stuttgart)"
          >
            {isLocatingActive ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <LocateFixed className="mr-1.5 h-3.5 w-3.5 text-primary" />
            )}
            <span>📍 Mein Standort</span>
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-muted-foreground">Zentrum:</span>
            <span className="font-medium text-foreground truncate">
              {location.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              ({location.lat}, {location.lng})
            </span>
          </div>

          <Badge variant="outline" className="font-mono text-xs shrink-0">
            Radius: {radiusKm} km
          </Badge>
        </div>

        <div>
          <Slider
            value={[radiusKm]}
            min={5}
            max={50}
            step={5}
            onValueChange={(val) => {
              const [nextRadius] = val;

              if (nextRadius !== undefined) {
                onRadiusChange(nextRadius);
              }
            }}
            aria-label="Suchradius in Kilometern"
          />

          <div className="mt-1 flex justify-between text-[10px] font-mono text-muted-foreground">
            <span>5 km</span>
            <span>25 km</span>
            <span>50 km</span>
          </div>
        </div>
      </div>

      <hr className="border-border/60" />

      {/* Date Selector Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spieltermin
            </span>
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => onDateChange('')}
              className="text-[11px] text-primary hover:underline"
            >
              Alle Termine
            </button>
          )}
        </div>

        {/* Quick Date Buttons */}
        <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
          <Button
            type="button"
            variant={selectedDate === todayStr ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateChange(todayStr)}
            className="h-8 text-xs flex-1"
          >
            Heute
          </Button>

          <Button
            type="button"
            variant={selectedDate === tomorrowStr ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateChange(tomorrowStr)}
            className="h-8 text-xs flex-1"
          >
            Morgen
          </Button>

          <Button
            type="button"
            variant={selectedDate === weekendStr ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateChange(weekendStr)}
            className="h-8 text-xs flex-1 truncate"
            title="Dieses Wochenende"
          >
            Wochenende
          </Button>
        </div>

        {/* Custom Date Input */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground shrink-0">
            Datum wählen:
          </span>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Eigenes Datum wählen"
          />
        </div>
      </div>

      <hr className="border-border/60" />

      {/* League Filter Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Liga filtern
            </span>
          </div>

          {onResetFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Zurücksetzen
            </Button>
          )}
        </div>

        {/* League Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onLeagueChange(undefined)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              selectedLeagueId === undefined
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
            }`}
          >
            Alle Ligen
          </button>

          {availableLeagues.map((league) => {
            const isActive = selectedLeagueId === league.id;

            return (
              <button
                key={league.id}
                type="button"
                onClick={() => onLeagueChange(isActive ? undefined : league.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                {league.name}
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-border/60" />

      {/* Last Sync Info Footer */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5 truncate">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="truncate">{formatLastSyncedAt(lastSyncedAt)}</span>
        </span>

        <span className="font-mono text-[10px] text-muted-foreground/70 shrink-0">
          DBB Live
        </span>
      </div>
    </div>
  );
}
