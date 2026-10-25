import * as React from 'react';
import {
  Calendar,
  ChevronDown,
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
  { id: 'this_weekend', label: 'Wochenende' },
  { id: 'next_weekend', label: 'Nächstes WE' },
  { id: 'all', label: 'Alle' },
];

export function VariantD_BottomBarSheet({
  isOpen,
  onClose,
  filters,
  availableOptions,
  actions,
}: FilterBarProps) {
  // Mobile Bottom Sheet open state
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);

  // Desktop Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  // Popovers on Desktop
  const [desktopPopover, setDesktopPopover] = React.useState<'date' | 'radius' | null>(null);

  // Sync external isOpen prop (e.g. from header or keyboard shortcut)
  React.useEffect(() => {
    if (isOpen) {
      setIsMobileSheetOpen(true);
      setIsSidebarCollapsed(false);
    }
  }, [isOpen]);

  const handleCloseMobileSheet = () => {
    setIsMobileSheetOpen(false);
    onClose();
  };

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

  const dateLabel = React.useMemo(() => {
    switch (dateMode) {
      case 'today':
        return 'Heute';
      case 'tomorrow':
        return 'Morgen';
      case 'this_weekend':
        return 'Wochenende';
      case 'next_weekend':
        return 'Nächstes WE';
      case 'custom':
        return 'Zeitraum';
      default:
        return 'Termin';
    }
  }, [dateMode]);

  // Shared Filter Form Body (Rendered in Desktop Sidebar & Mobile Bottom Sheet)
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
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          Spieltermin
        </span>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {DATE_PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDateMode(item.id)}
              className={`rounded py-1.5 text-xs font-medium transition ${
                dateMode === item.id
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
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
          placeholder="Verein oder Team suchen..."
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
            Mein Standort
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
        {teamQuery && (
          <p className="text-[11px] text-muted-foreground italic">
            Bei aktiver Vereinssuche werden alle Hallen des Teams angezeigt.
          </p>
        )}
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
                className={`rounded-lg py-1.5 text-xs font-medium border transition ${
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
                className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
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
      {/* 1. DESKTOP SPLIT-SIDEBAR (≥ md Screen: Left Side of Map) */}
      <aside
        className={`hidden md:flex flex-col border-r border-border/80 bg-background/95 backdrop-blur-md shadow-xl transition-all duration-300 relative z-30 shrink-0 ${
          isSidebarCollapsed ? 'w-12' : 'w-80 lg:w-96'
        }`}
      >
        {/* Toggle Collapse Button */}
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-5 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
          title={isSidebarCollapsed ? 'Seitenleiste ausklappen' : 'Seitenleiste minimieren'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        {isSidebarCollapsed ? (
          <div className="flex flex-col items-center py-6 gap-4 text-muted-foreground">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(false)}
              className="p-1 hover:text-foreground"
              aria-label="Filter öffnen"
            >
              <SlidersHorizontal className="h-5 w-5 text-primary" />
            </button>
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
                  Filter & Umkreis
                </h2>
              </div>
              <Badge variant="outline" className="text-[10px]">
                {effectiveMatchCount} Spiele
              </Badge>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 overscroll-contain">
              {filterFormContent}
            </div>
          </div>
        )}
      </aside>

      {/* 2. REFINED BOTTOM QUICK-FILTER BAR (Mobile-First, thumb-friendly at bottom edge) */}
      <div
        data-testid="bottom-filter-bar"
        className="fixed md:absolute bottom-4 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
      >
        <div className="pointer-events-auto flex max-w-full flex-col items-center rounded-2xl border border-slate-700/80 bg-slate-950/90 shadow-2xl backdrop-blur-xl p-1.5 ring-1 ring-white/10 transition-all">
          {/* Subtle Pull-up Handle for Mobile */}
          <button
            type="button"
            onClick={() => setIsMobileSheetOpen(true)}
            className="md:hidden flex w-full items-center justify-center pt-0.5 pb-1 text-slate-400 hover:text-slate-200 transition"
            aria-label="Filter-Menü nach oben ziehen"
          >
            <div className="h-1 w-10 rounded-full bg-slate-500/60" />
          </button>

          {/* Quick-Filter Buttons Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full px-0.5">
            {/* Date Quick Pill */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setDesktopPopover(desktopPopover === 'date' ? null : 'date');
                }
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                dateMode !== 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{dateLabel}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>

            {/* Radius Quick Pill */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setDesktopPopover(desktopPopover === 'radius' ? null : 'radius');
                }
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                teamQuery
                  ? 'bg-slate-800/40 text-slate-500 line-through'
                  : radiusKm !== 30
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Compass className="h-3.5 w-3.5" />
              <span>{teamQuery ? 'Alle Hallen' : `${radiusKm} km`}</span>
              {!teamQuery && <ChevronDown className="h-3 w-3 opacity-70" />}
            </button>

            {/* Team Search Pill / Input */}
            {teamQuery ? (
              <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary/20 border border-primary/40 px-2.5 py-1 text-xs font-medium text-primary">
                <span className="truncate max-w-[120px] sm:max-w-[180px]">
                  🏀 {teamQuery}
                </span>
                <button
                  type="button"
                  onClick={() => setTeamQuery(undefined)}
                  className="rounded-full p-0.5 hover:bg-primary/20 text-primary"
                  aria-label="Vereinsfilter aufheben"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setIsSidebarCollapsed(false);
                  }
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-800 transition"
              >
                <Trophy className="h-3.5 w-3.5 text-primary" />
                <span className="truncate max-w-[110px] sm:max-w-[140px]">
                  Verein suchen...
                </span>
              </button>
            )}

            {/* Primary Filter Button (Opens Bottom Sheet / Expands Sidebar) */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-110 active:scale-95"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-mono text-[10px] font-bold text-primary">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop Quick Date Popover */}
        {desktopPopover === 'date' && (
          <div className="hidden md:block absolute bottom-full mb-2 left-0 z-40 w-52 rounded-xl border border-border bg-popover/95 p-2 shadow-2xl backdrop-blur-md">
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
                    setDesktopPopover(null);
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

        {/* Desktop Quick Radius Popover */}
        {desktopPopover === 'radius' && (
          <div className="hidden md:block absolute bottom-full mb-2 left-20 z-40 w-56 rounded-xl border border-border bg-popover/95 p-3 shadow-2xl backdrop-blur-md">
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
                    setDesktopPopover(null);
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
                setDesktopPopover(null);
              }}
              className="w-full text-xs h-7"
            >
              <LocateFixed className="mr-1.5 h-3.5 w-3.5 text-primary" />
              Mein Standort
            </Button>
          </div>
        )}
      </div>

      {/* 3. MOBILE BOTTOM SHEET (Sliding up from bottom, thumb-reachable) */}
      {isMobileSheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
            onClick={handleCloseMobileSheet}
          />

          {/* Bottom Sheet Container */}
          <div className="relative z-10 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
            {/* Drag Handle Bar & Header */}
            <div className="flex flex-col items-center pt-3 pb-2 border-b border-border/60">
              <div className="h-1.5 w-12 rounded-full bg-slate-600/60 mb-2" />
              <div className="flex w-full items-center justify-between px-5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    Filter & Umkreis
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCloseMobileSheet}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Schließen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-5 overscroll-contain">
              {filterFormContent}
            </div>

            {/* Sticky Action Footer */}
            <div className="border-t border-border p-4 bg-slate-950/95 flex gap-2">
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
                onClick={handleCloseMobileSheet}
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
