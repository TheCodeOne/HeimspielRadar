import * as React from 'react';
import {
  Calendar,
  Check,
  Compass,
  Layers,
  Loader2,
  LocateFixed,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { League } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  formatLastSyncedAt,
  getThisWeekendSaturdayString,
  getTodayString,
  getTomorrowString,
} from '@/lib/date-utils';
import type { DateMode } from '@/lib/filter-storage';
import type { LocationReference } from '@/lib/geo-utils';

export interface FilterBarProps {
  isOpen?: boolean;
  onClose?: () => void;
  matchCount?: number;
  dateMode: DateMode;
  customDate?: string;
  selectedDate: string;
  onDateModeChange: (mode: DateMode, customDate?: string) => void;
  onlyUpcoming?: boolean;
  onOnlyUpcomingChange?: (onlyUpcoming: boolean) => void;
  radiusKm: number;
  onRadiusChange: (radius: number) => void;
  location: LocationReference;
  onLocationChange: (loc: LocationReference) => void;
  leagues: League[];
  availableGenders: string[];
  availableAgeClasses: string[];
  availableSkillLevels: string[];
  selectedGenders: string[];
  onGendersChange: (genders: string[]) => void;
  selectedAgeClasses: string[];
  onAgeClassesChange: (ageClasses: string[]) => void;
  selectedSkillLevels: string[];
  onSkillLevelsChange: (skillLevels: string[]) => void;
  selectedLeagueIds: number[];
  onLeagueIdsChange: (leagueIds: number[]) => void;
  onResetFilters: () => void;
  onRequestLocation?: () => void;
  isLocating?: boolean;
  lastSyncedAt?: string | null;
  className?: string;
}

function formatGenderLabel(gender: string): string {
  const lower = gender.toLowerCase();

  if (lower === 'männlich') {
    return 'Männlich';
  }

  if (lower === 'weiblich') {
    return 'Weiblich';
  }

  if (lower === 'mixed') {
    return 'Mixed';
  }

  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function toggleArrayItem<T>(items: T[], item: T): T[] {
  if (items.includes(item)) {
    return items.filter((existing) => existing !== item);
  }

  return [...items, item];
}

export function FilterBar({
  isOpen = true,
  onClose,
  matchCount = 0,
  dateMode,
  customDate,
  selectedDate,
  onDateModeChange,
  onlyUpcoming = true,
  onOnlyUpcomingChange,
  radiusKm,
  onRadiusChange,
  location,
  onLocationChange,
  leagues,
  availableGenders,
  availableAgeClasses,
  availableSkillLevels,
  selectedGenders,
  onGendersChange,
  selectedAgeClasses,
  onAgeClassesChange,
  selectedSkillLevels,
  onSkillLevelsChange,
  selectedLeagueIds,
  onLeagueIdsChange,
  onResetFilters,
  onRequestLocation,
  isLocating = false,
  lastSyncedAt,
  className = '',
}: FilterBarProps) {
  const [internalLocating, setInternalLocating] = React.useState(false);
  const [leagueSearch, setLeagueSearch] = React.useState('');

  const todayStr = getTodayString();
  const tomorrowStr = getTomorrowString();
  const weekendStr = getThisWeekendSaturdayString();

  // Close drawer on ESC key press
  React.useEffect(() => {
    if (!isOpen || !onClose) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

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

  // Narrow individual leagues dynamically based on selected hierarchy + search query
  const filteredLeagues = React.useMemo(() => {
    const query = leagueSearch.trim().toLowerCase();

    return leagues.filter((league) => {
      if (
        selectedGenders.length > 0 &&
        (!league.geschlecht || !selectedGenders.includes(league.geschlecht))
      ) {
        return false;
      }

      if (
        selectedAgeClasses.length > 0 &&
        (!league.akName || !selectedAgeClasses.includes(league.akName))
      ) {
        return false;
      }

      if (
        selectedSkillLevels.length > 0 &&
        (!league.skName || !selectedSkillLevels.includes(league.skName))
      ) {
        return false;
      }

      if (query.length > 0) {
        const haystack = [
          league.name,
          league.akName,
          league.skName,
          league.geschlecht,
          league.verbandName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [
    leagues,
    selectedGenders,
    selectedAgeClasses,
    selectedSkillLevels,
    leagueSearch,
  ]);

  if (!isOpen) {
    return null;
  }

  const isLocatingActive = isLocating || internalLocating;

  const filterFormContent = (
    <div className={`space-y-5 ${className}`}>
      {/* 1. Location & Radius Section */}
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

      {/* 2. Date Selector Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spieltermin
            </span>
          </div>

          {dateMode !== 'all' && (
            <button
              type="button"
              onClick={() => onDateModeChange('all')}
              className="text-[11px] text-primary hover:underline"
            >
              Alle Termine
            </button>
          )}
        </div>

        {/* Quick Date Buttons */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Button
            type="button"
            variant={
              dateMode === 'today' || (dateMode === 'custom' && selectedDate === todayStr)
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => onDateModeChange('today')}
            className="h-8 text-xs"
          >
            Heute
          </Button>

          <Button
            type="button"
            variant={
              dateMode === 'tomorrow' || (dateMode === 'custom' && selectedDate === tomorrowStr)
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => onDateModeChange('tomorrow')}
            className="h-8 text-xs"
          >
            Morgen
          </Button>

          <Button
            type="button"
            variant={
              dateMode === 'weekend' || (dateMode === 'custom' && selectedDate === weekendStr)
                ? 'default'
                : 'outline'
            }
            size="sm"
            onClick={() => onDateModeChange('weekend')}
            className="h-8 text-xs truncate"
            title="Dieses Wochenende"
          >
            Wochenende
          </Button>

          <Button
            type="button"
            variant={dateMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onDateModeChange('all')}
            className="h-8 text-xs truncate"
          >
            Alle Termine
          </Button>
        </div>

        {/* Custom Date Input */}
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground shrink-0">
            Datum wählen:
          </span>
          <input
            type="date"
            value={dateMode === 'custom' ? customDate ?? selectedDate : selectedDate}
            onChange={(e) => {
              const nextDate = e.target.value;

              if (!nextDate) {
                onDateModeChange('all');

                return;
              }

              onDateModeChange('custom', nextDate);
            }}
            className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Eigenes Datum wählen"
          />
        </div>

        {/* Toggle: Only Upcoming Matches Without Results */}
        {onOnlyUpcomingChange && (
          <button
            type="button"
            role="switch"
            aria-checked={onlyUpcoming}
            onClick={() => onOnlyUpcomingChange(!onlyUpcoming)}
            className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">
                Nur anstehende Spiele (ohne Ergebnis)
              </div>
              <div className="text-[11px] text-muted-foreground">
                Blendet vergangene und bereits gespielte Partien aus
              </div>
            </div>

            <span
              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                onlyUpcoming ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-background shadow-xs transition-transform ${
                  onlyUpcoming ? 'translate-x-4' : 'translate-x-1'
                }`}
              />
            </span>
          </button>
        )}
      </div>

      <hr className="border-border/60" />

      {/* 3. Geschlecht (genders) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Geschlecht
            </span>
          </div>

          {selectedGenders.length > 0 && (
            <button
              type="button"
              onClick={() => onGendersChange([])}
              className="text-[11px] text-primary hover:underline"
            >
              Alle ({selectedGenders.length} gewählt)
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {availableGenders.map((gender) => {
            const isSelected = selectedGenders.includes(gender);

            return (
              <button
                key={gender}
                type="button"
                onClick={() =>
                  onGendersChange(toggleArrayItem(selectedGenders, gender))
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                {formatGenderLabel(gender)}
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-border/60" />

      {/* 4. Altersklasse (ageClasses / akName) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Altersklasse
            </span>
          </div>

          {selectedAgeClasses.length > 0 && (
            <button
              type="button"
              onClick={() => onAgeClassesChange([])}
              className="text-[11px] text-primary hover:underline"
            >
              Alle ({selectedAgeClasses.length} gewählt)
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {availableAgeClasses.map((ageClass) => {
            const isSelected = selectedAgeClasses.includes(ageClass);

            return (
              <button
                key={ageClass}
                type="button"
                onClick={() =>
                  onAgeClassesChange(toggleArrayItem(selectedAgeClasses, ageClass))
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                {ageClass}
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-border/60" />

      {/* 5. Spielklasse (skillLevels / skName) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Spielklasse
            </span>
          </div>

          {selectedSkillLevels.length > 0 && (
            <button
              type="button"
              onClick={() => onSkillLevelsChange([])}
              className="text-[11px] text-primary hover:underline"
            >
              Alle ({selectedSkillLevels.length} gewählt)
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {availableSkillLevels.map((skillLevel) => {
            const isSelected = selectedSkillLevels.includes(skillLevel);

            return (
              <button
                key={skillLevel}
                type="button"
                onClick={() =>
                  onSkillLevelsChange(
                    toggleArrayItem(selectedSkillLevels, skillLevel),
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                {skillLevel}
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-border/60" />

      {/* 6. Einzel-Ligen (Searchable Multi-Select League List) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Einzel-Ligen ({filteredLeagues.length})
            </span>
          </div>

          {selectedLeagueIds.length > 0 && (
            <button
              type="button"
              onClick={() => onLeagueIdsChange([])}
              className="text-[11px] text-primary hover:underline"
            >
              Auswahl aufheben ({selectedLeagueIds.length})
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={leagueSearch}
            onChange={(e) => setLeagueSearch(e.target.value)}
            placeholder="Liga suchen (z.B. Oberliga, Neckar, U18)..."
            className="h-8 w-full rounded-md border border-input bg-background pr-7 pl-8 text-xs text-foreground shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Einzel-Ligen durchsuchen"
          />
          {leagueSearch && (
            <button
              type="button"
              onClick={() => setLeagueSearch('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Suche löschen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filtered League Items */}
        <div className="max-h-52 overflow-y-auto overscroll-contain rounded-lg border border-border/70 bg-muted/20 p-1.5 space-y-1">
          {filteredLeagues.length === 0 ? (
            <div className="py-4 text-center text-xs text-muted-foreground">
              Keine passenden Ligen für die gewählten Filter gefunden.
            </div>
          ) : (
            filteredLeagues.map((league) => {
              const isSelected = selectedLeagueIds.includes(league.id);

              const metaBadges = [
                league.akName,
                league.skName,
                league.geschlecht ? formatGenderLabel(league.geschlecht) : undefined,
              ].filter(Boolean);

              return (
                <button
                  key={league.id}
                  type="button"
                  onClick={() =>
                    onLeagueIdsChange(toggleArrayItem(selectedLeagueIds, league.id))
                  }
                  className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-primary/15 text-foreground font-medium border border-primary/40'
                      : 'hover:bg-muted/60 text-foreground border border-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{league.name}</div>
                    {metaBadges.length > 0 && (
                      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                        {metaBadges.join(' • ')}
                      </div>
                    )}
                  </div>

                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background'
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                </button>
              );
            })
          )}
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

  // If onClose is provided, render inside an accessible Slide-Over Filter Drawer
  if (onClose) {
    return (
      <div
        className="fixed inset-0 z-50 flex justify-end overscroll-none"
        role="dialog"
        aria-modal="true"
        aria-label="Filtereinstellungen"
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Slide-Over Sheet Panel */}
        <aside className="relative z-10 flex h-dvh w-full max-w-md flex-col border-l border-border/80 bg-background shadow-2xl">
          {/* Sticky Header */}
          <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold tracking-tight text-foreground">
                Filter & Spielklassen
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Filter schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Filter Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-5">{filterFormContent}</div>

          {/* Sticky Drawer Footer */}
          <div className="flex items-center justify-between gap-3 border-t border-border/80 bg-card/80 px-5 py-3.5 backdrop-blur-md">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResetFilters}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Zurücksetzen
            </Button>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onClose}
              className="flex-1 text-xs font-semibold"
            >
              {matchCount} {matchCount === 1 ? 'Spiel' : 'Spiele'} anzeigen
            </Button>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      {filterFormContent}
    </div>
  );
}
