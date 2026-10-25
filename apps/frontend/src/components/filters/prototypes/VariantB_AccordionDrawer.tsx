import * as React from 'react';
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Compass,
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

export function VariantB_AccordionDrawer({
  isOpen,
  onClose,
  filters,
  availableOptions,
  actions,
}: FilterBarProps) {
  // Accordion state
  const [isAudienceOpen, setIsAudienceOpen] = React.useState(
    filters.genders.length > 0 || filters.ageClasses.length > 0
  );

  const [isLeaguesOpen, setIsLeaguesOpen] = React.useState(
    filters.skillLevels.length > 0 || filters.leagueIds.length > 0
  );

  const {
    dateMode,
    dateFrom,
    dateTo,
    dateRangeDisplay,
    radiusKm,
    teamQuery,
    genders,
    ageClasses,
    skillLevels,
    leagueIds,
    activeFilterCount,
  } = filters;

  const {
    setDateMode,
    setDateRange,
    setRadius: setRadiusKm,
    setTeamQuery,
    setGenders,
    setAgeClasses,
    setSkillLevels,
    setLeagueIds,
    resetFilters,
  } = actions;

  const effectiveMatchCount =
    availableOptions.matchesCount ?? availableOptions.matchCount ?? 0;

  if (!isOpen) {
    return null;
  }

  const audienceActiveCount = genders.length + ageClasses.length;
  const leaguesActiveCount = skillLevels.length + leagueIds.length;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="relative z-10 flex h-dvh w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        {/* Sticky Header with Filter Pills */}
        <div className="flex flex-col border-b border-border/80 px-5 py-3.5 bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <h2 className="text-base font-bold text-foreground">
                Filter (Variante B)
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

          {/* Active Filter Pills Strip */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5">
              {teamQuery && (
                <Badge
                  variant="default"
                  className="gap-1 text-[11px] font-semibold shrink-0"
                >
                  <span>🏀 {teamQuery}</span>
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setTeamQuery(undefined)}
                  />
                </Badge>
              )}
              {dateMode !== 'all' && (
                <Badge
                  variant="secondary"
                  className="gap-1 text-[11px] font-medium shrink-0"
                >
                  <span>📅 {dateMode}</span>
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => setDateMode('all')}
                  />
                </Badge>
              )}
              {genders.map((g) => (
                <Badge
                  key={g}
                  variant="outline"
                  className="gap-1 text-[11px] shrink-0"
                >
                  <span>{g}</span>
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      setGenders(genders.filter((x) => x !== g))
                    }
                  />
                </Badge>
              ))}
              {ageClasses.map((ak) => (
                <Badge
                  key={ak}
                  variant="outline"
                  className="gap-1 text-[11px] shrink-0"
                >
                  <span>{ak}</span>
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      setAgeClasses(ageClasses.filter((x) => x !== ak))
                    }
                  />
                </Badge>
              ))}
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-muted-foreground hover:text-foreground shrink-0 underline ml-1"
              >
                Alle löschen
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* SECTION 1: BASIS-FILTER (Immer geöffnet) */}
          <div className="space-y-4">
            {/* Spieltermin Segmented Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  Spieltermin
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1 rounded-xl border border-border/80 bg-muted/50 p-1">
                {DATE_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDateMode(item.id)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition-all ${
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
            </div>

            {/* Verein / Team Suche */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-primary" />
                  Verein oder Team
                </span>
                {teamQuery && (
                  <button
                    type="button"
                    onClick={() => setTeamQuery(undefined)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Zurücksetzen
                  </button>
                )}
              </div>
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

            {/* Standort & Umkreis */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-primary" />
                  Suchumkreis ({radiusKm} km)
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

              <div className="grid grid-cols-4 gap-1.5">
                {[10, 25, 50, 100].map((km) => (
                  <button
                    key={km}
                    type="button"
                    disabled={Boolean(teamQuery)}
                    onClick={() => setRadiusKm(km)}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                      radiusKm === km && !teamQuery
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    } ${teamQuery ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    {km} km
                  </button>
                ))}
              </div>

              <div className="pt-1">
                <Slider
                  min={5}
                  max={100}
                  step={5}
                  value={[radiusKm]}
                  onValueChange={(val) => val[0] && setRadiusKm(val[0])}
                  disabled={Boolean(teamQuery)}
                />
              </div>
            </div>
          </div>

          <hr className="border-border/60" />

          {/* SECTION 2: AKKORDEON "Zielgruppe & Jugend" */}
          <div className="rounded-xl border border-border/80 bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAudienceOpen(!isAudienceOpen)}
              className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted/40 transition"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span>Zielgruppe & Jugend</span>
                {audienceActiveCount > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.2 text-[10px] font-bold">
                    {audienceActiveCount}
                  </span>
                )}
              </div>
              {isAudienceOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isAudienceOpen && (
              <div className="p-3.5 pt-0 space-y-4 border-t border-border/40">
                {/* Geschlecht Segmented Control */}
                <div className="space-y-1.5 pt-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Geschlecht
                  </span>
                  <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1">
                    {[
                      { id: 'männlich', label: 'Herren' },
                      { id: 'weiblich', label: 'Damen' },
                      { id: 'mix', label: 'Mixed' },
                    ].map((g) => {
                      const isSelected = genders.includes(g.id);

                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() =>
                            setGenders(
                              isSelected
                                ? genders.filter((x) => x !== g.id)
                                : [...genders, g.id]
                            )
                          }
                          className={`rounded-md py-1 text-xs font-semibold transition ${
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {g.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Altersklassen Matrix */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Altersklassen (2-Spalten-Raster)
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
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
                          className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                            isSelected
                              ? 'border-primary bg-primary/10 text-primary font-bold'
                              : 'border-border/80 bg-background hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <span>{ak}</span>
                          {isSelected && <span>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: AKKORDEON "Ligen & Spielklassen" */}
          <div className="rounded-xl border border-border/80 bg-card/60 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsLeaguesOpen(!isLeaguesOpen)}
              className="flex w-full items-center justify-between p-3.5 text-left text-xs font-bold uppercase tracking-wider text-foreground hover:bg-muted/40 transition"
            >
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <span>Spielklassen & Einzel-Ligen</span>
                {leaguesActiveCount > 0 && (
                  <span className="rounded-full bg-primary text-primary-foreground px-1.5 py-0.2 text-[10px] font-bold">
                    {leaguesActiveCount}
                  </span>
                )}
              </div>
              {isLeaguesOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isLeaguesOpen && (
              <div className="p-3.5 pt-0 space-y-4 border-t border-border/40">
                {/* Spielklasse Level */}
                <div className="space-y-1.5 pt-3">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Level
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {availableOptions.skillLevels.map((lvl) => {
                      const isSelected = skillLevels.includes(lvl);

                      return (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() =>
                            setSkillLevels(
                              isSelected
                                ? skillLevels.filter((x) => x !== lvl)
                                : [...skillLevels, lvl]
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-xs font-medium border transition ${
                            isSelected
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {lvl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Einzelligen */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Einzelligen ({availableOptions.leagues.length})
                  </span>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-border p-2 space-y-1">
                    {availableOptions.leagues.slice(0, 40).map((l) => {
                      const isSelected = leagueIds.includes(l.id);

                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() =>
                            setLeagueIds(
                              isSelected
                                ? leagueIds.filter((x) => x !== l.id)
                                : [...leagueIds, l.id]
                            )
                          }
                          className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                            isSelected
                              ? 'bg-primary/15 text-primary font-semibold'
                              : 'hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          <span className="truncate">{l.name}</span>
                          {isSelected && <span className="text-primary font-bold">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Drawer Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border/80 bg-card/80 px-5 py-3.5 backdrop-blur-md">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetFilters}
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
            {effectiveMatchCount} {effectiveMatchCount === 1 ? 'Spiel' : 'Spiele'} anzeigen
          </Button>
        </div>
      </aside>
    </div>
  );
}
