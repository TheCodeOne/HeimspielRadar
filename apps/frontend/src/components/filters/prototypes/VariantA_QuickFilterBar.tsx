import * as React from 'react';
import {
  Calendar,
  ChevronDown,
  Compass,
  LocateFixed,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type {
  FilterBarProps,
} from '@/components/filters/FilterBar';
import { TeamSearchInput } from '@/components/filters/shared/TeamSearchInput';
import type { MatchFiltersState } from '@/lib/use-match-filters';

interface DatePreset {
  id: MatchFiltersState['dateMode'];
  label: string;
}

const DATE_PRESETS: DatePreset[] = [
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'this_weekend', label: 'Dieses Wochenende' },
  { id: 'next_weekend', label: 'Nächstes Wochenende' },
  { id: 'all', label: 'Alle Termine' },
];

export function VariantA_QuickFilterBar({
  isOpen,
  onClose,
  filters,
  availableOptions,
  actions,
}: FilterBarProps) {
  const [openPopover, setOpenPopover] = React.useState<
    'date' | 'radius' | 'category' | null
  >(null);

  const {
    dateMode,
    setDateMode,
    radiusKm,
    setRadiusKm,
    teamQuery,
    setTeamQuery,
    genders,
    setGenders,
    ageClasses,
    setAgeClasses,
    activeFilterCount,
    resetFilters,
  } = filters;

  const effectiveMatchCount =
    availableOptions.matchesCount ?? availableOptions.matchCount ?? 0;

  // Close popovers on click outside
  const barRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        barRef.current &&
        e.target instanceof Node &&
        !barRef.current.contains(e.target)
      ) {
        setOpenPopover(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const dateLabel = React.useMemo(() => {
    switch (dateMode) {
      case 'today':
        return 'Heute';
      case 'tomorrow':
        return 'Morgen';
      case 'this_weekend':
        return 'Dieses WE';
      case 'next_weekend':
        return 'Nächstes WE';
      case 'custom':
        return 'Zeitraum';
      default:
        return 'Termin';
    }
  }, [dateMode]);

  const categoryLabel = React.useMemo(() => {
    const parts: string[] = [];

    if (genders.length > 0) {
      parts.push(genders.map((g) => g.slice(0, 1).toUpperCase()).join('/'));
    }

    if (ageClasses.length > 0) {
      parts.push(ageClasses.slice(0, 2).join(', '));
    }

    if (parts.length === 0) {
      return 'Klasse';
    }

    return parts.join(' • ');
  }, [genders, ageClasses]);

  return (
    <>
      {/* 1. Floating Horizontal Quick-Filter Bar on Map */}
      <div
        ref={barRef}
        className="absolute top-3 inset-x-3 z-20 flex items-center justify-between pointer-events-none"
      >
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-2xl border border-border/80 bg-background/95 p-1.5 shadow-xl backdrop-blur-md max-w-full">
          {/* Quick Date Pill */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() =>
                setOpenPopover(openPopover === 'date' ? null : 'date')
              }
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                dateMode !== 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-foreground hover:bg-muted'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{dateLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {openPopover === 'date' && (
              <div className="absolute left-0 top-full mt-2 z-30 w-52 rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-md">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase px-2 py-1">
                  Spieltermin wählen
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {DATE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setDateMode(preset.id);
                        setOpenPopover(null);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium ${
                        dateMode === preset.id
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Radius Pill */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() =>
                setOpenPopover(openPopover === 'radius' ? null : 'radius')
              }
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                teamQuery
                  ? 'bg-muted/40 text-muted-foreground line-through opacity-70'
                  : radiusKm !== 30
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-foreground hover:bg-muted'
              }`}
              title={
                teamQuery
                  ? 'Umkreis bei Vereinssuche deaktiviert'
                  : 'Umkreis anpassen'
              }
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{teamQuery ? 'Alle Hallen' : `${radiusKm} km`}</span>
              {!teamQuery && <ChevronDown className="h-3 w-3 opacity-70" />}
            </button>

            {openPopover === 'radius' && !teamQuery && (
              <div className="absolute left-0 top-full mt-2 z-30 w-56 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase pb-2">
                  Suchradius
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  {[10, 25, 50, 100].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => {
                        setRadiusKm(km);
                        setOpenPopover(null);
                      }}
                      className={`rounded-lg py-1 text-xs font-semibold ${
                        radiusKm === km
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border/80 hover:bg-muted text-foreground'
                      }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    actions.handleGetCurrentLocation();
                    setOpenPopover(null);
                  }}
                  className="w-full text-xs h-7"
                >
                  <LocateFixed className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Mein Standort
                </Button>
              </div>
            )}
          </div>

          {/* Inline Team Search Pill */}
          <div className="w-48 sm:w-64 shrink-0">
            <TeamSearchInput
              value={teamQuery || ''}
              compact
              placeholder="Verein / Team suchen..."
              onSelectSuggestion={(s) => {
                setTeamQuery(s.name);

                if (s.akName) {
                  setAgeClasses([s.akName]);
                }

                if (s.geschlecht) {
                  setGenders([s.geschlecht]);
                }
              }}
              onSelectRawQuery={(raw) => setTeamQuery(raw)}
              onClear={() => setTeamQuery(undefined)}
            />
          </div>

          {/* Quick Category (Altersklasse / Geschlecht) Pill */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() =>
                setOpenPopover(openPopover === 'category' ? null : 'category')
              }
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                genders.length > 0 || ageClasses.length > 0
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/60 text-foreground hover:bg-muted'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="truncate max-w-[80px] sm:max-w-[120px]">
                {categoryLabel}
              </span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {openPopover === 'category' && (
              <div className="absolute right-0 top-full mt-2 z-30 w-64 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase pb-1.5">
                  Geschlecht
                </div>
                <div className="grid grid-cols-3 gap-1 mb-3">
                  {['männlich', 'weiblich', 'mix'].map((g) => {
                    const isSelected = genders.includes(g);

                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() =>
                          setGenders(
                            isSelected
                              ? genders.filter((x) => x !== g)
                              : [...genders, g]
                          )
                        }
                        className={`rounded-lg py-1 text-xs font-medium ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'border border-border/80 hover:bg-muted text-foreground'
                        }`}
                      >
                        {g === 'männlich'
                          ? 'Herren'
                          : g === 'weiblich'
                          ? 'Damen'
                          : 'Mix'}
                      </button>
                    );
                  })}
                </div>

                <div className="text-[11px] font-semibold text-muted-foreground uppercase pb-1.5">
                  Jugend / Alter
                </div>
                <div className="flex flex-wrap gap-1">
                  {['U10', 'U12', 'U14', 'U16', 'U18', 'Senioren'].map(
                    (ak) => {
                      const isSelected = ageClasses.includes(ak);

                      return (
                        <button
                          key={ak}
                          type="button"
                          onClick={() =>
                            setAgeClasses(
                              isSelected
                                ? ageClasses.filter((x) => x !== ak)
                                : [...ageClasses, ak]
                            )
                          }
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'border border-border/80 hover:bg-muted text-foreground'
                          }`}
                        >
                          {ak}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Alle Filter Button (Opens Light Drawer) */}
          <button
            type="button"
            onClick={actions.toggleFilterDrawer}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 ${
              activeFilterCount > 0
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                : 'border border-border/80 bg-background hover:bg-muted text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Alle Filter</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-amber-500 text-black px-1.5 text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Matches Counter Pill */}
        <div className="hidden lg:flex pointer-events-auto items-center gap-1.5 rounded-xl border border-border/80 bg-background/95 px-3 py-2 text-xs font-semibold shadow-lg backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {effectiveMatchCount} {effectiveMatchCount === 1 ? 'Spiel' : 'Spiele'}
          </span>
        </div>
      </div>

      {/* 2. Light Drawer for Secondary Filters (When isOpen is true) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />

          <aside className="relative z-10 flex h-dvh w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 px-5 py-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  Erweiterte Filter
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Active Filters Summary */}
              {activeFilterCount > 0 && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center justify-between text-xs font-semibold pb-2">
                    <span>{activeFilterCount} aktive Filter</span>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-primary hover:underline"
                    >
                      Alle zurücksetzen
                    </button>
                  </div>
                </div>
              )}

              {/* Ligen & Spielklassen */}
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Spielklasse (Level)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableOptions.skillLevels.map((lvl) => {
                    const isSelected = filters.skillLevels.includes(lvl);

                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() =>
                          filters.setSkillLevels(
                            isSelected
                              ? filters.skillLevels.filter((x) => x !== lvl)
                              : [...filters.skillLevels, lvl]
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Einzelne Ligen Multi-Select */}
              <div className="space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Einzel-Ligen ({availableOptions.leagues.length})
                </span>
                <div className="max-h-60 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                  {availableOptions.leagues.slice(0, 30).map((l) => {
                    const isSelected = filters.leagueIds.includes(l.id);

                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() =>
                          filters.setLeagueIds(
                            isSelected
                              ? filters.leagueIds.filter((x) => x !== l.id)
                              : [...filters.leagueIds, l.id]
                          )
                        }
                        className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'hover:bg-muted text-muted-foreground'
                        }`}
                      >
                        <span className="truncate">{l.name}</span>
                        {isSelected && <span className="text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4 bg-card/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
              >
                Zurücksetzen
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={onClose}
                className="flex-1 font-semibold"
              >
                {effectiveMatchCount} Spiele anzeigen
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
