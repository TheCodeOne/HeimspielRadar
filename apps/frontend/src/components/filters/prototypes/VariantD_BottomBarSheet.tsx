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
  Search,
  SlidersHorizontal,
  Sparkles,
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
import { useBottomSheetDrag } from '@/lib/use-bottom-sheet-drag';

interface DatePreset {
  id: MatchFiltersState['dateMode'];
  label: string;
}

const DATE_PRESETS: DatePreset[] = [
  { id: 'today', label: 'Heute' },
  { id: 'tomorrow', label: 'Morgen' },
  { id: 'weekend', label: 'Wochenende' },
  { id: 'next-weekend', label: 'Nächstes WE' },
  { id: 'all', label: 'Alle' },
];

export interface VariantDProps extends FilterBarProps {
  hasSelectedVenue?: boolean;
}

export function VariantD_BottomBarSheet({
  isOpen,
  onClose,
  filters,
  availableOptions,
  actions,
  hasSelectedVenue = false,
}: VariantDProps) {
  // Mobile Bottom Sheet open state
  const [isMobileSheetOpen, setIsMobileSheetOpen] = React.useState(false);

  // Gesture drag & spring animation hook for mobile bottom sheet
  const {
    isAnimatingOut,
    dragY,
    isDragging,
    closeWithAnimation,
    touchHandlers: sheetTouchHandlers,
  } = useBottomSheetDrag({
    onClose: () => {
      setIsMobileSheetOpen(false);
      onClose();
    },
  });

  // Swipe-up detection on the collapsed bottom bar
  const barTouchStartYRef = React.useRef(0);

  const handleBarTouchStart = React.useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];

    if (touch) {
      barTouchStartYRef.current = touch.clientY;
    }
  }, []);

  const handleBarTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];

      if (!touch) {
        return;
      }

      const deltaY = touch.clientY - barTouchStartYRef.current;

      // Swipe up gesture (drag up >= 15px) opens sheet smoothly
      if (deltaY < -15 && !isMobileSheetOpen) {
        setIsMobileSheetOpen(true);
      }
    },
    [isMobileSheetOpen]
  );

  // Bottom Bar Style: 'docked' (Apple Maps Peek) vs 'capsule' (Airbnb Floating Pill)
  const [bottomBarStyle, setBottomBarStyle] = React.useState<'docked' | 'capsule'>(() => {
    if (typeof window !== 'undefined') {
      const s = new URLSearchParams(window.location.search).get('style');

      if (s === 'capsule') {
        return 'capsule';
      }
    }

    return 'docked';
  });

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

  const {
    dateMode,
    dateFrom,
    dateTo,
    dateRangeDisplay,
    onlyUpcoming,
    radiusKm,
    teamQuery,
    genders,
    ageClasses,
    activeFilterCount,
  } = filters;

  const {
    setDateMode,
    setDateRange,
    setOnlyUpcoming,
    setRadius: setRadiusKm,
    setTeamQuery,
    setGenders,
    setAgeClasses,
    resetFilters,
  } = actions;

  const effectiveMatchCount =
    availableOptions.matchesCount ?? availableOptions.matchCount ?? 0;

  const dateLabel = React.useMemo(() => {
    switch (dateMode) {
      case 'today':
        return 'Heute';
      case 'tomorrow':
        return 'Morgen';
      case 'weekend':
        return 'Wochenende';
      case 'next-weekend':
        return 'Nächstes WE';
      case 'custom':
        return dateRangeDisplay || 'Zeitraum';
      default:
        return 'Termin';
    }
  }, [dateMode, dateRangeDisplay]);

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

      {/* 2. Spieltermin & Manuelle Zeitspanne */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Spieltermin
          </span>
          {dateMode === 'custom' && (
            <Badge variant="outline" className="text-[10px] font-mono border-primary/40 text-primary bg-primary/5">
              Eigener Zeitraum
            </Badge>
          )}
        </div>

        {/* Quick Date Presets */}
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

        {/* Manuelle Zeitspanne (Datum Von – Bis) */}
        <div className="rounded-xl border border-border/70 bg-card/60 p-2.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase">
            <span>Manuelle Zeitspanne</span>
            {dateMode === 'custom' && (
              <span className="font-mono text-[10px] text-primary lowercase">
                {dateRangeDisplay}
              </span>
            )}
          </div>

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

        {/* Toggle: Nur anstehende Spiele */}
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card/40 p-2.5">
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-foreground block">
              Nur anstehende Spiele
            </span>
            <span className="text-[10px] text-muted-foreground block">
              Beendete Spiele mit Endergebnis ausblenden
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={onlyUpcoming}
            onClick={() => setOnlyUpcoming(!onlyUpcoming)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              onlyUpcoming ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                onlyUpcoming ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
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

      {/* 2. BOTTOM QUICK-FILTER AREA (Hidden when a venue/match modal is active to prevent any overlap) */}
      {!hasSelectedVenue && (bottomBarStyle === 'docked' ? (
        /* STYLE 1: NATIVE DOCKED BOTTOM SHEET PEEK (Apple Maps standard) */
        <div
          data-testid="bottom-filter-bar"
          className="fixed md:absolute bottom-0 inset-x-0 md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 flex flex-col items-center w-full md:max-w-xl pointer-events-none"
        >
          <div
            onTouchStart={handleBarTouchStart}
            onTouchMove={handleBarTouchMove}
            className="pointer-events-auto w-full md:rounded-2xl rounded-t-[28px] border-t md:border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-2xl px-4 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))] md:py-2.5 ring-1 ring-white/10 transition-all"
          >
            {/* Native Drag Handle for Mobile */}
            <button
              type="button"
              onTouchStart={handleBarTouchStart}
              onTouchMove={handleBarTouchMove}
              onClick={() => setIsMobileSheetOpen(true)}
              className="md:hidden flex w-full flex-col items-center pt-0.5 pb-2 text-slate-400 hover:text-slate-200 transition touch-none cursor-grab active:cursor-grabbing"
              aria-label="Filter & Suche nach oben ziehen oder öffnen"
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-600/70" />
            </button>

            {/* Row 1: Native Search Capsule & Filter Trigger */}
            <div className="flex items-center gap-2">
              {teamQuery ? (
                <div className="flex flex-1 items-center justify-between rounded-2xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-primary shadow-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{teamQuery}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTeamQuery(undefined)}
                    className="rounded-full p-1 hover:bg-primary/20 text-primary transition"
                    aria-label="Vereinsfilter aufheben"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMobileSheetOpen(true)}
                  className="flex flex-1 items-center gap-2.5 rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2 text-xs text-slate-300 hover:border-slate-500 hover:bg-slate-800 transition shadow-inner group"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Search className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <span className="block truncate font-medium text-slate-200 group-hover:text-primary transition leading-tight">
                      Verein oder Team suchen...
                    </span>
                    <span className="block truncate text-[10px] text-slate-400 font-mono">
                      {dateLabel} • {radiusKm} km • {effectiveMatchCount} Spiele
                    </span>
                  </div>
                </button>
              )}

              {/* Primary Filter Button */}
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setIsSidebarCollapsed(false);
                  }
                }}
                className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition hover:brightness-110 active:scale-95"
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

            {/* Row 2: Horizontal Quick Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 px-0.5">
              {/* Date Chip */}
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setDesktopPopover(desktopPopover === 'date' ? null : 'date');
                  }
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                  dateMode !== 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>{dateLabel}</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {/* Radius Chip */}
              <button
                type="button"
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSheetOpen(true);
                  } else {
                    setDesktopPopover(desktopPopover === 'radius' ? null : 'radius');
                  }
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                  teamQuery
                    ? 'bg-slate-800/40 text-slate-500 line-through'
                    : radiusKm !== 30
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-slate-800/80 text-slate-200 hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                <span>{teamQuery ? 'Alle Hallen' : `${radiusKm} km`}</span>
                {!teamQuery && <ChevronDown className="h-3 w-3 opacity-70" />}
              </button>

              {/* Quick Gender Chips */}
              {['männlich', 'weiblich'].map((g) => {
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
                    className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-medium border transition ${
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground font-semibold'
                        : 'border-slate-700/60 bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {g === 'männlich' ? 'Herren' : 'Damen'}
                  </button>
                );
              })}

              {/* Style Switcher Toggle */}
              <button
                type="button"
                onClick={() => setBottomBarStyle('capsule')}
                className="shrink-0 flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 border border-dashed border-slate-700 hover:border-slate-500 transition ml-auto"
                title="Zur schwebenden Kapsel-Ansicht wechseln"
              >
                <Sparkles className="h-3 w-3 text-amber-400" />
                <span>Kapsel-Style</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STYLE 2: FLOATING SEARCH CAPSULE (Airbnb / Google Explore Style) */
        <div
          data-testid="bottom-filter-bar"
          className="fixed md:absolute bottom-4 inset-x-3 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5"
        >
          <div
            onTouchStart={handleBarTouchStart}
            onTouchMove={handleBarTouchMove}
            className="pointer-events-auto flex items-center divide-x divide-slate-700/80 rounded-full border border-slate-700/80 bg-slate-950/95 shadow-2xl backdrop-blur-xl px-2 py-1.5 ring-1 ring-white/10 transition hover:border-slate-500"
          >
            {/* Segment 1: Team Search Trigger */}
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex items-center gap-2 px-3 py-1 text-left text-xs font-semibold text-slate-200 hover:text-primary transition"
            >
              <Search className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate max-w-[110px] sm:max-w-[150px]">
                {teamQuery ? teamQuery : 'Verein suchen...'}
              </span>
            </button>

            {/* Segment 2: Date Trigger */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setDesktopPopover(desktopPopover === 'date' ? null : 'date');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 hover:text-foreground transition"
            >
              <Calendar className="h-3.5 w-3.5 text-primary/80" />
              <span>{dateLabel}</span>
            </button>

            {/* Segment 3: Radius Trigger */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setDesktopPopover(desktopPopover === 'radius' ? null : 'radius');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 hover:text-foreground transition"
            >
              <Compass className="h-3.5 w-3.5 text-primary/80" />
              <span>{teamQuery ? 'Alle' : `${radiusKm}km`}</span>
            </button>

            {/* Segment 4: Primary Filter Button */}
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsMobileSheetOpen(true);
                } else {
                  setIsSidebarCollapsed(false);
                }
              }}
              className="flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs font-bold text-primary-foreground"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:scale-105 active:scale-95">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </div>
              <span className="hidden sm:inline">Filter</span>
              {activeFilterCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400 font-mono text-[10px] font-bold text-slate-950">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Style Switcher Toggle Button */}
          <button
            type="button"
            onClick={() => setBottomBarStyle('docked')}
            className="pointer-events-auto flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-slate-200 border border-slate-700/60 shadow-sm backdrop-blur-md"
            title="Zur angedockten Apple Maps Ansicht wechseln"
          >
            <span>📱 Zu Dock-Ansicht wechseln</span>
          </button>
        </div>
      ))}

        {/* Desktop Quick Date Popover */}
        {desktopPopover === 'date' && (
          <div className="hidden md:block absolute bottom-full mb-2 left-0 z-40 w-64 rounded-xl border border-border bg-popover/95 p-2.5 shadow-2xl backdrop-blur-md">
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

            {/* Custom Date Range in Desktop Popover */}
            <div className="pt-2 mt-2 border-t border-border/60">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase px-1 mb-1.5 flex items-center justify-between">
                <span>Eigener Zeitraum</span>
                {dateMode === 'custom' && (
                  <span className="text-[10px] text-primary lowercase">{dateRangeDisplay}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5 px-1">
                <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                  <span>Von</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      const nextFrom = e.target.value;
                      const nextTo = dateTo && nextFrom && dateTo < nextFrom ? nextFrom : dateTo;
                      setDateRange(nextFrom, nextTo);
                    }}
                    className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Desktop Startdatum (Von)"
                  />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
                  <span>Bis</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      const nextTo = e.target.value;
                      const nextFrom = dateFrom && nextTo && nextTo < dateFrom ? nextTo : dateFrom;
                      setDateRange(nextFrom, nextTo);
                    }}
                    className="h-7 w-full rounded-md border border-border bg-background px-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    aria-label="Desktop Enddatum (Bis)"
                  />
                </label>
              </div>
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

      {/* 3. MOBILE BOTTOM SHEET (Sliding up from bottom, thumb-reachable) */}
      {isMobileSheetOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className={`fixed inset-0 bg-black/70 backdrop-blur-xs ${
              isAnimatingOut ? 'animate-backdrop-out' : 'animate-backdrop-in'
            }`}
            onClick={closeWithAnimation}
          />

          {/* Bottom Sheet Container with iOS Spring Animation & Drag Gesture */}
          <div
            style={
              dragY > 0
                ? {
                    transform: `translateY(${dragY}px)`,
                    transition: isDragging
                      ? 'none'
                      : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
                  }
                : undefined
            }
            className={`relative z-10 flex max-h-[85dvh] flex-col rounded-t-[28px] border-t border-slate-700/80 bg-slate-950 shadow-2xl overflow-hidden ${
              isAnimatingOut ? 'modal-mobile-sheet-out' : 'modal-mobile-sheet-in'
            }`}
          >
            {/* Drag Handle Bar & Header (Touch gesture zone) */}
            <div
              {...sheetTouchHandlers}
              className="flex flex-col items-center pt-3 pb-2 border-b border-border/60 cursor-grab active:cursor-grabbing touch-none select-none"
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-600/70 mb-2" />
              <div className="flex w-full items-center justify-between px-5">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold text-foreground">
                    Filter & Umkreis
                  </span>
                </div>
                <button
                  type="button"
                  onClick={closeWithAnimation}
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
                onClick={closeWithAnimation}
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
