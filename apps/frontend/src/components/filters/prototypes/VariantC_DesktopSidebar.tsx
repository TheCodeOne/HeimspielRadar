import * as React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Compass,
  Layers,
  LocateFixed,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { FilterBarProps } from '@/components/filters/FilterBar';
import { TeamSearchInput } from '@/components/filters/shared/TeamSearchInput';
import type { MatchFiltersState } from '@/lib/use-match-filters';

interface DatePreset {
  id: MatchFiltersState['dateMode'];
  label: string;
}

const DATE_PRESETS: DatePreset[] = [
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'weekend', label: 'Wochenende' },
  { id: 'all', label: 'Alle' },
];

export function VariantC_DesktopSidebar({
  isOpen,
  onClose,
  filters,
  availableOptions,
  actions,
}: FilterBarProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const {
    dateMode,
    dateFrom,
    dateTo,
    dateRangeDisplay,
    radiusKm,
    teamQuery,
    genders,
    ageClasses,
    activeFilterCount,
  } = filters;

  const {
    setDateMode,
    setDateRange,
    setRadius: setRadiusKm,
    setTeamQuery,
    setGenders,
    setAgeClasses,
    resetFilters,
  } = actions;

  const effectiveMatchCount =
    availableOptions.matchesCount ?? availableOptions.matchCount ?? 0;

  // Filter Form Body (Shared between Desktop Sidebar and Mobile Bottom Sheet)
  const filterFormContent = (
    <div className="space-y-5">
      {/* 1. Quick Stats & Reset */}
      <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
        <div>
          <span className="font-bold text-foreground">
            {effectiveMatchCount} Spiele
          </span>{' '}
          <span className="text-muted-foreground">gefunden</span>
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Zurücksetzen
          </button>
        )}
      </div>

      {/* 2. Spieltermin */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Termin
          </span>
          {dateMode === 'custom' && (
            <span className="font-mono text-[10px] text-primary lowercase">
              {dateRangeDisplay}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {DATE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDateMode(item.id)}
              className={`rounded py-1 text-xs font-medium transition ${
                dateMode === item.id
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Manuelle Zeitspanne */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 space-y-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase block">
            Manuelle Zeitspanne
          </span>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-medium text-muted-foreground">Von</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  const nextFrom = e.target.value;
                  const nextTo = dateTo && nextFrom && dateTo < nextFrom ? nextFrom : dateTo;
                  setDateRange(nextFrom, nextTo);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Startdatum (Von)"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs">
              <span className="text-[10px] font-medium text-muted-foreground">Bis</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  const nextTo = e.target.value;
                  const nextFrom = dateFrom && nextTo && nextTo < dateFrom ? nextTo : dateFrom;
                  setDateRange(nextFrom, nextTo);
                }}
                className="h-8 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                aria-label="Enddatum (Bis)"
              />
            </label>
          </div>
        </div>
      </div>

      {/* 3. Vereinssuche */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Trophy className="h-3.5 w-3.5 text-primary" />
          Verein / Team
        </span>
        <TeamSearchInput
          value={teamQuery || ''}
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

      {/* 4. Umkreis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-primary" />
            Umkreis: {radiusKm} km
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={actions.handleGetCurrentLocation}
            className="h-6 px-1.5 text-[11px] text-primary"
          >
            <LocateFixed className="mr-1 h-3 w-3" />
            Ortung
          </Button>
        </div>
        <Slider
          min={5}
          max={100}
          step={5}
          value={[radiusKm]}
          onValueChange={(val) => val[0] && setRadiusKm(val[0])}
          disabled={Boolean(teamQuery)}
        />
      </div>

      {/* 5. Geschlecht */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          Geschlecht
        </span>
        <div className="grid grid-cols-3 gap-1">
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
                className={`rounded-lg py-1 text-xs font-medium border transition ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground font-bold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {g === 'männlich' ? 'Herren' : g === 'weiblich' ? 'Damen' : 'Mix'}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Altersklasse Chips */}
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Layers className="h-3.5 w-3.5 text-primary" />
          Altersklasse
        </span>
        <div className="flex flex-wrap gap-1">
          {availableOptions.ageClasses.map((ak) => {
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
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium border transition ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground font-semibold'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                {ak}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP SPLIT SIDEBAR (Permanent on md+ screen, docked to left of map) */}
      <aside
        className={`hidden md:flex flex-col border-r border-border/80 bg-background/95 backdrop-blur-md shadow-xl transition-all duration-300 relative z-30 shrink-0 ${
          isCollapsed ? 'w-12' : 'w-80 lg:w-96'
        }`}
      >
        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-5 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
          title={isCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste minimieren'}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {isCollapsed ? (
          <div className="flex flex-col items-center py-6 gap-4 text-muted-foreground">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
            <span className="[writing-mode:vertical-rl] text-xs font-bold tracking-wider uppercase rotate-180">
              Filter ({activeFilterCount})
            </span>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-4 py-3.5 bg-card/60">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  Filter-Sidebar (Variante C)
                </h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                Split-View
              </Badge>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
              {filterFormContent}
            </div>
          </div>
        )}
      </aside>

      {/* MOBILE BOTTOM SHEET (< md, when isOpen is true) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Bottom Sheet Container */}
          <div className="relative z-10 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-border bg-background shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Drag Handle Bar */}
            <div className="flex flex-col items-center pt-3 pb-2 border-b border-border/60">
              <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30 mb-2" />
              <div className="flex w-full items-center justify-between px-5">
                <span className="text-sm font-bold text-foreground">
                  Filter & Umkreis
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5">{filterFormContent}</div>

            {/* Sticky Action Footer */}
            <div className="border-t border-border p-4 bg-card/90 flex gap-2">
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
                className="flex-1 font-bold"
              >
                {effectiveMatchCount} Spiele anzeigen
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
