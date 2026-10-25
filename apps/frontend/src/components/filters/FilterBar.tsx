import * as React from 'react';
import {
  Calendar,
  Check,
  Compass,
  Layers,
  Loader2,
  LocateFixed,
  Map,
  MapPin,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { League, TeamSuggestion } from '@sundayleague/shared-types';
import { MAP_ENGINE_OPTIONS } from '@/components/map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  type CitySuggestion,
  fetchPhotonGeocode,
  searchCuratedCities,
} from '@/lib/cities';
import { formatLastSyncedAt } from '@/lib/date-utils';
import { getDonationUrl, getTransparencyUrl } from '@/lib/donation';
import { STUTTGART_FALLBACK } from '@/lib/geo-utils';
import { getSampleMatches } from '@/lib/sample-matches';
import {
  filterLeaguesByHierarchy,
  type MatchFiltersActions,
  type MatchFiltersState,
} from '@/lib/use-match-filters';

export interface FilterAvailableOptions {
  leagues: League[];
  genders: string[];
  ageClasses: string[];
  skillLevels: string[];
  matchCount?: number;
  matchesCount?: number;
  lastSyncedAt?: string | null;
}

export interface FilterBarProps {
  isOpen?: boolean;
  onClose?: () => void;
  filters: MatchFiltersState;
  availableOptions: FilterAvailableOptions;
  actions: MatchFiltersActions;
  className?: string;
  donationUrl?: string;
  transparencyUrl?: string;
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
  filters,
  availableOptions,
  actions,
  className = '',
  donationUrl = getDonationUrl(),
  transparencyUrl = getTransparencyUrl(),
}: FilterBarProps) {
  const {
    viewMode,
    mapEngine,
    location,
    radiusKm,
    showRadiusCircle,
    dateMode,
    dateFrom,
    dateTo,
    onlyUpcoming,
    genders: selectedGenders,
    ageClasses: selectedAgeClasses,
    skillLevels: selectedSkillLevels,
    leagueIds: selectedLeagueIds,
    isLocating,
  } = filters;

  const {
    leagues,
    genders: availableGenders,
    ageClasses: availableAgeClasses,
    skillLevels: availableSkillLevels,
    matchCount = 0,
    matchesCount,
    lastSyncedAt,
  } = availableOptions;

  const {
    setViewMode,
    setMapEngine,
    setLocation,
    setRadius,
    setShowRadiusCircle,
    setDateMode,
    setDateRange,
    setOnlyUpcoming,
    setTeamQuery,
    setGenders,
    setAgeClasses,
    setSkillLevels,
    setLeagueIds,
    resetFilters,
    locateUser,
  } = actions;

  const [leagueSearch, setLeagueSearch] = React.useState('');
  const [cityQuery, setCityQuery] = React.useState('');
  const [isCityDropdownOpen, setIsCityDropdownOpen] = React.useState(false);

  const [teamInput, setTeamInput] = React.useState(filters.teamQuery ?? '');
  const [teamSuggestions, setTeamSuggestions] = React.useState<TeamSuggestion[]>([]);
  const [isSearchingTeams, setIsSearchingTeams] = React.useState(false);
  const [isTeamDropdownOpen, setIsTeamDropdownOpen] = React.useState(false);
  const [highlightedTeamIndex, setHighlightedTeamIndex] = React.useState(-1);
  const teamSearchContainerRef = React.useRef<HTMLDivElement>(null);

  const [localSuggestions, setLocalSuggestions] =
    React.useState<CitySuggestion[]>([]);

  const [onlineSuggestions, setOnlineSuggestions] =
    React.useState<CitySuggestion[]>([]);

  const [isSearchingOnline, setIsSearchingOnline] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const citySearchContainerRef = React.useRef<HTMLDivElement>(null);

  // Sync teamInput when filters.teamQuery changes
  React.useEffect(() => {
    setTeamInput(filters.teamQuery ?? '');
  }, [filters.teamQuery]);

  // Reset cityQuery and close suggestions when location reference changes
  React.useEffect(() => {
    setCityQuery('');
    setIsCityDropdownOpen(false);
    setLocalSuggestions([]);
    setOnlineSuggestions([]);
  }, [location.name, location.lat, location.lng]);

  // Close city & team suggestions dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        event.target instanceof Node &&
        citySearchContainerRef.current &&
        !citySearchContainerRef.current.contains(event.target)
      ) {
        setIsCityDropdownOpen(false);
      }

      if (
        event.target instanceof Node &&
        teamSearchContainerRef.current &&
        !teamSearchContainerRef.current.contains(event.target)
      ) {
        setIsTeamDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter curated cities instantly + debounce online Photon geocoding
  React.useEffect(() => {
    const q = cityQuery.trim();

    if (!q) {
      setLocalSuggestions([]);
      setOnlineSuggestions([]);
      setIsSearchingOnline(false);

      return;
    }

    const local = searchCuratedCities(q, 6);

    setLocalSuggestions(local);
    setHighlightedIndex(-1);

    if (q.length < 3) {
      setOnlineSuggestions([]);
      setIsSearchingOnline(false);

      return;
    }

    const controller = new AbortController();

    setIsSearchingOnline(true);

    const timer = setTimeout(async () => {
      try {
        const results = await fetchPhotonGeocode(
          q,
          { lat: location.lat, lng: location.lng },
          controller.signal,
        );

        setOnlineSuggestions(results);
      } catch {
        setOnlineSuggestions([]);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cityQuery, location.lat, location.lng]);

  // Debounced search for team suggestions
  React.useEffect(() => {
    const q = teamInput.trim();

    if (!q) {
      setTeamSuggestions([]);
      setIsSearchingTeams(false);
      setHighlightedTeamIndex(-1);

      return;
    }

    const controller = new AbortController();

    setIsSearchingTeams(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matches/teams?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch team suggestions: ${res.status}`);
        }

        // SAFETY: /api/matches/teams returns TeamSuggestion[]
        const data = (await res.json()) as TeamSuggestion[];

        // Defensive deduplication across (name + akName + geschlecht)
        const seen = new Set<string>();
        const deduped: TeamSuggestion[] = [];

        for (const item of data) {
          const key = `${item.name}|${item.akName ?? ''}|${item.geschlecht ?? ''}`;

          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(item);
          }
        }

        setTeamSuggestions(deduped);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        // Fallback: search teams from sample matches
        const pool = getSampleMatches();
        const seen = new Set<string>();
        const localMatches: TeamSuggestion[] = [];
        const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);

        for (const m of pool) {
          for (const t of [m.homeTeam, m.guestTeam]) {
            const key = `${t.name}|${m.league?.akName ?? ''}|${m.league?.geschlecht ?? ''}`;

            if (seen.has(key)) {
              continue;
            }

            const allTokensMatch = tokens.every((tok) => {
              const nameMatch = t.name.toLowerCase().includes(tok);
              const shortNameMatch = Boolean(t.shortName?.toLowerCase().includes(tok));
              const akMatch = Boolean(m.league?.akName?.toLowerCase().includes(tok));
              const genderMatch = Boolean(m.league?.geschlecht?.toLowerCase().includes(tok));

              return nameMatch || shortNameMatch || akMatch || genderMatch;
            });

            if (allTokensMatch) {
              seen.add(key);
              localMatches.push({
                id: t.id,
                name: t.name,
                shortName: t.shortName,
                clubId: t.clubId,
                akName: m.league?.akName,
                geschlecht: m.league?.geschlecht,
              });
            }
          }
        }

        setTeamSuggestions(localMatches.slice(0, 20));
      } finally {
        setIsSearchingTeams(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [teamInput]);

  const handleSelectSuggestion = React.useCallback(
    (suggestion: TeamSuggestion) => {
      setTeamQuery(suggestion.name);
      setTeamInput(suggestion.name);

      if (suggestion.akName) {
        setAgeClasses([suggestion.akName]);
      }

      if (suggestion.geschlecht) {
        setGenders([suggestion.geschlecht]);
      }

      setIsTeamDropdownOpen(false);
    },
    [setAgeClasses, setGenders, setTeamQuery],
  );

  const handleSelectQuery = React.useCallback(
    (rawQuery: string) => {
      setTeamQuery(rawQuery);
      setTeamInput(rawQuery);
      setIsTeamDropdownOpen(false);
    },
    [setTeamQuery],
  );

  const handleClearTeam = React.useCallback(() => {
    setTeamQuery(undefined);
    setTeamInput('');
    setTeamSuggestions([]);
    setIsTeamDropdownOpen(false);
  }, [setTeamQuery]);

  const handleTeamInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isTeamDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        setIsTeamDropdownOpen(true);

        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedTeamIndex((prev) =>
          prev < teamSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedTeamIndex((prev) =>
          prev > 0 ? prev - 1 : teamSuggestions.length - 1,
        );
      } else if (e.key === 'Enter') {
        if (highlightedTeamIndex >= 0 && teamSuggestions[highlightedTeamIndex]) {
          e.preventDefault();
          handleSelectSuggestion(teamSuggestions[highlightedTeamIndex]);
        } else if (teamInput.trim()) {
          e.preventDefault();
          handleSelectQuery(teamInput.trim());
        }
      } else if (e.key === 'Escape') {
        setIsTeamDropdownOpen(false);
      }
    },
    [handleSelectQuery, handleSelectSuggestion, highlightedTeamIndex, isTeamDropdownOpen, teamInput, teamSuggestions],
  );

  const allSuggestions = React.useMemo(() => {
    const uniqueOnline = onlineSuggestions.filter((online) => {
      const onlineLower = online.name.trim().toLowerCase();

      return !localSuggestions.some((local) => {
        const localLower = local.name.trim().toLowerCase();

        if (
          onlineLower === localLower ||
          onlineLower.includes(localLower) ||
          localLower.includes(onlineLower)
        ) {
          return true;
        }

        const dLat = Math.abs(online.lat - local.lat);
        const dLng = Math.abs(online.lng - local.lng);

        return dLat < 0.05 && dLng < 0.05;
      });
    });

    return [...localSuggestions, ...uniqueOnline];
  }, [localSuggestions, onlineSuggestions]);

  const handleSelectLocation = React.useCallback(
    (item: CitySuggestion) => {
      const q = cityQuery.trim();
      let selectedName = item.name;

      if (/^\d{5}$/.test(q) && !selectedName.includes(q)) {
        selectedName = `${q} ${item.name}`;
      }

      setLocation({
        lat: item.lat,
        lng: item.lng,
        name: selectedName,
      });

      setCityQuery('');
      setIsCityDropdownOpen(false);
      setLocalSuggestions([]);
      setOnlineSuggestions([]);
    },
    [cityQuery, setLocation],
  );

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const q = cityQuery.trim();

    if (!q) {
      return;
    }

    if (highlightedIndex >= 0 && allSuggestions[highlightedIndex]) {
      handleSelectLocation(allSuggestions[highlightedIndex]);

      return;
    }

    if (allSuggestions.length > 0) {
      handleSelectLocation(allSuggestions[0]);

      return;
    }

    setIsSearchingOnline(true);

    try {
      const results = await fetchPhotonGeocode(q, {
        lat: location.lat,
        lng: location.lng,
      });

      if (results.length > 0) {
        handleSelectLocation(results[0]);
      }
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleCityInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsCityDropdownOpen(true);
      setHighlightedIndex((prev) =>
        prev < allSuggestions.length - 1 ? prev + 1 : 0,
      );

      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsCityDropdownOpen(true);
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : allSuggestions.length - 1,
      );

      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearchSubmit();

      return;
    }

    if (e.key === 'Escape') {
      setIsCityDropdownOpen(false);

      return;
    }
  };

  const handleClearCitySearch = () => {
    setCityQuery('');
    setIsCityDropdownOpen(false);
    setLocalSuggestions([]);
    setOnlineSuggestions([]);
  };

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
    void locateUser();
  };

  // Narrow individual leagues dynamically based on selected hierarchy + search query
  const filteredLeagues = React.useMemo(() => {
    return filterLeaguesByHierarchy(leagues, {
      genders: selectedGenders,
      ageClasses: selectedAgeClasses,
      skillLevels: selectedSkillLevels,
      search: leagueSearch,
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

  const effectiveMatchCount = matchesCount ?? matchCount;

  const filterFormContent = (
    <div className={`space-y-5 ${className}`}>
      {/* 0. View Mode Switcher Section (Ansicht: 🗺️ Karte vs. 📋 Liste) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ansicht
          </span>
        </div>

        <div
          className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/80 bg-muted/60 p-1"
          role="tablist"
          aria-label="Ansicht wechseln"
        >
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'map'}
            onClick={() => setViewMode('map')}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              viewMode === 'map'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>🗺️</span>
            <span>Karte</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={viewMode === 'list'}
            onClick={() => setViewMode('list')}
            className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-all ${
              viewMode === 'list'
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>📋</span>
            <span>Liste ({effectiveMatchCount})</span>
          </button>
        </div>
      </div>

      <hr className="border-border/60" />

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
            disabled={isLocating}
            className="h-7 text-xs font-medium"
            title="Eigenen Standort abfragen (Fallback: Stuttgart)"
          >
            {isLocating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <LocateFixed className="mr-1.5 h-3.5 w-3.5 text-primary" />
            )}
            <span>📍 Mein Standort</span>
          </Button>
        </div>

        {/* City & Postal Code Autocomplete Search */}
        <div ref={citySearchContainerRef} className="relative">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value);
                  setIsCityDropdownOpen(true);
                }}
                onFocus={() => {
                  if (cityQuery.trim().length > 0 || allSuggestions.length > 0) {
                    setIsCityDropdownOpen(true);
                  }
                }}
                onKeyDown={handleCityInputKeyDown}
                placeholder="Stadt oder PLZ suchen..."
                aria-label="Stadt oder Postleitzahl suchen"
                className="w-full rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {cityQuery && (
                <button
                  type="button"
                  onClick={handleClearCitySearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Suche zurücksetzen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isSearchingOnline || !cityQuery.trim()}
              className="h-8 px-2.5 text-xs font-medium shrink-0"
            >
              {isSearchingOnline ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                'Suchen'
              )}
            </Button>
          </form>

          {/* Autocomplete Dropdown */}
          {isCityDropdownOpen &&
            (allSuggestions.length > 0 ||
              isSearchingOnline ||
              (cityQuery.trim().length >= 2 &&
                !isSearchingOnline &&
                allSuggestions.length === 0)) && (
              <div
                role="listbox"
                aria-label="Städtevorschläge"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md"
              >
                {allSuggestions.map((suggestion, idx) => {
                  const isSelected = idx === highlightedIndex;

                  return (
                    <button
                      key={`${suggestion.name}-${suggestion.lat}-${suggestion.lng}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectLocation(suggestion)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{suggestion.name}</span>
                        {suggestion.state && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {suggestion.state}
                          </span>
                        )}
                      </div>

                      {suggestion.postalCodes.length > 0 && (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground shrink-0">
                          PLZ {suggestion.postalCodes[0]}
                        </span>
                      )}
                    </button>
                  );
                })}

                {isSearchingOnline && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                    <span>Suche online nach weiteren Orten...</span>
                  </div>
                )}

                {!isSearchingOnline &&
                  allSuggestions.length === 0 &&
                  cityQuery.trim().length >= 2 && (
                    <div className="px-2.5 py-2 text-center text-xs text-muted-foreground">
                      Keine Treffer für &ldquo;{cityQuery}&rdquo;. Drücke Enter für
                      Online-Suche.
                    </div>
                  )}
              </div>
            )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-muted-foreground">Zentrum:</span>
            <span
              className="font-medium text-foreground truncate"
              title={`${location.name} (${location.lat}, ${location.lng})`}
            >
              📍 {location.name}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground shrink-0">
              ({location.lat}, {location.lng})
            </span>
            {location.name !== STUTTGART_FALLBACK.name && (
              <button
                type="button"
                onClick={() => setLocation(STUTTGART_FALLBACK)}
                className="ml-0.5 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Auf Stuttgart zurücksetzen"
                aria-label="Auf Stuttgart zurücksetzen"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
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
                setRadius(nextRadius);
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

        <button
          type="button"
          role="switch"
          aria-checked={showRadiusCircle}
          onClick={() => setShowRadiusCircle(!showRadiusCircle)}
          className="mt-2.5 flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/25 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">
              Suchradius auf Karte anzeigen
            </div>
            <div className="text-[11px] text-muted-foreground">
              Visualisiert den {radiusKm}-km-Umkreis als transparenten Kreis
            </div>
          </div>

          <span
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
              showRadiusCircle ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-background shadow-xs transition-transform ${
                showRadiusCircle ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </span>
        </button>
      </div>

      <hr className="border-border/60" />

      {/* 1.5. Verein / Team Search Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verein / Team
            </span>
          </div>

          {filters.teamQuery && (
            <button
              type="button"
              onClick={handleClearTeam}
              className="text-[11px] text-primary hover:underline"
            >
              Zurücksetzen
            </button>
          )}
        </div>

        {/* Team Autocomplete Search Input */}
        <div ref={teamSearchContainerRef} className="relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (highlightedTeamIndex >= 0 && teamSuggestions[highlightedTeamIndex]) {
                handleSelectSuggestion(teamSuggestions[highlightedTeamIndex]);
              } else if (teamInput.trim()) {
                handleSelectQuery(teamInput.trim());
              }
            }}
            className="flex items-center gap-1.5"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={teamInput}
                onChange={(e) => {
                  setTeamInput(e.target.value);
                  setIsTeamDropdownOpen(true);
                }}
                onFocus={() => {
                  if (teamInput.trim().length > 0 || teamSuggestions.length > 0) {
                    setIsTeamDropdownOpen(true);
                  }
                }}
                onKeyDown={handleTeamInputKeyDown}
                placeholder="Verein oder Team suchen, z.B. SV Pfrondorf..."
                aria-label="Verein oder Team suchen"
                className="w-full rounded-md border border-input bg-background/60 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {teamInput && (
                <button
                  type="button"
                  onClick={handleClearTeam}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Vereinssuche zurücksetzen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={isSearchingTeams || !teamInput.trim()}
              className="h-8 px-2.5 text-xs font-medium shrink-0"
            >
              {isSearchingTeams ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                'Filtern'
              )}
            </Button>
          </form>

          {/* Autocomplete Dropdown */}
          {isTeamDropdownOpen &&
            (teamSuggestions.length > 0 ||
              isSearchingTeams ||
              (teamInput.trim().length >= 2 &&
                !isSearchingTeams &&
                teamSuggestions.length === 0)) && (
              <div
                role="listbox"
                aria-label="Vereinsvorschläge"
                className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur-md"
              >
                {teamSuggestions.map((suggestion, idx) => {
                  const isSelected = idx === highlightedTeamIndex;

                  return (
                    <button
                      key={`${suggestion.id}-${suggestion.name}-${suggestion.akName ?? ''}-${suggestion.geschlecht ?? ''}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      onMouseEnter={() => setHighlightedTeamIndex(idx)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">🏀</span>
                        <span className="truncate font-medium">{suggestion.name}</span>
                        {suggestion.shortName && suggestion.shortName !== suggestion.name && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({suggestion.shortName})
                          </span>
                        )}
                      </div>
                      {(suggestion.akName || suggestion.geschlecht) && (
                        <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground shrink-0">
                          {[suggestion.akName, suggestion.geschlecht].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </button>
                  );
                })}

                {isSearchingTeams && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                    <span>Suche Teams...</span>
                  </div>
                )}

                {!isSearchingTeams &&
                  teamSuggestions.length === 0 &&
                  teamInput.trim().length >= 2 && (
                    <div className="px-2.5 py-2 text-center text-xs text-muted-foreground">
                      Kein Team gefunden für &ldquo;{teamInput}&rdquo;. Drücke Enter zum
                      Filtern.
                    </div>
                  )}
              </div>
            )}
        </div>

        {/* Active Selected Team Badge */}
        {filters.teamQuery && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-muted-foreground">Aktives Team:</span>
            <Badge
              variant="default"
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs py-0.5 px-2.5 shadow-xs"
            >
              <span>🏀 {filters.teamQuery}</span>
              <button
                type="button"
                onClick={handleClearTeam}
                className="ml-1 rounded hover:bg-primary-foreground/20 p-0.5 text-primary-foreground transition-colors"
                aria-label="Vereinsfilter entfernen"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          </div>
        )}
      </div>

      <hr className="border-border/60" />

      {/* 2. Date Selector Section */}
      <div className="space-y-3">
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
              onClick={() => setDateMode('all')}
              className="text-[11px] text-primary hover:underline"
            >
              Alle Termine
            </button>
          )}
        </div>

        {/* Preset Date & Weekend Chips */}
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            variant={dateMode === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('today')}
            className="h-8 text-xs"
          >
            Heute
          </Button>

          <Button
            type="button"
            variant={dateMode === 'tomorrow' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('tomorrow')}
            className="h-8 text-xs"
          >
            Morgen
          </Button>

          <Button
            type="button"
            variant={dateMode === 'weekend' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('weekend')}
            className="h-8 text-xs truncate"
            title="Samstag & Sonntag dieses Wochenendes"
          >
            Dieses Wochenende
          </Button>

          <Button
            type="button"
            variant={dateMode === 'next-weekend' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('next-weekend')}
            className="h-8 text-xs truncate"
            title="Samstag & Sonntag des nächsten Wochenendes"
          >
            Nächstes Wochenende
          </Button>

          <Button
            type="button"
            variant={dateMode === 'weekend-after-next' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('weekend-after-next')}
            className="h-8 text-xs truncate"
            title="Samstag & Sonntag des übernächsten Wochenendes"
          >
            Übernächstes Wochenende
          </Button>

          <Button
            type="button"
            variant={dateMode === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateMode('all')}
            className="h-8 text-xs truncate"
          >
            Alle Termine
          </Button>
        </div>

        {/* Custom Date Range Inputs (Zeitspanne Von – Bis) */}
        <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/20 p-2.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>Zeitspanne (Von – Bis)</span>
            {dateMode === 'custom' && (
              <Badge variant="outline" className="text-[10px]">
                Eigener Zeitraum
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 font-medium text-muted-foreground">
                Von
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  const nextFrom = e.target.value;

                  const nextTo =
                    dateTo && nextFrom && dateTo < nextFrom ? nextFrom : dateTo;

                  setDateRange(nextFrom, nextTo);
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Startdatum (Von)"
              />
            </label>

            <label className="flex items-center gap-2 text-xs">
              <span className="w-8 shrink-0 font-medium text-muted-foreground">
                Bis
              </span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  const nextTo = e.target.value;

                  const nextFrom =
                    dateFrom && nextTo && nextTo < dateFrom ? nextTo : dateFrom;

                  setDateRange(nextFrom, nextTo);
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Enddatum (Bis)"
              />
            </label>
          </div>
        </div>

        {/* Toggle: Only Upcoming Matches Without Results */}
        <button
          type="button"
          role="switch"
          aria-checked={onlyUpcoming}
          onClick={() => setOnlyUpcoming(!onlyUpcoming)}
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
              onClick={() => setGenders([])}
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
                  setGenders(toggleArrayItem(selectedGenders, gender))
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
              onClick={() => setAgeClasses([])}
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
                  setAgeClasses(toggleArrayItem(selectedAgeClasses, ageClass))
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
              onClick={() => setSkillLevels([])}
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
                  setSkillLevels(toggleArrayItem(selectedSkillLevels, skillLevel))
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
              onClick={() => setLeagueIds([])}
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
                    setLeagueIds(toggleArrayItem(selectedLeagueIds, league.id))
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

      {/* 7. Karten-Renderer (Map Engine Selector) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Map className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Karten-Renderer
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {MAP_ENGINE_OPTIONS.map((opt) => {
            const isSelected = opt.id === mapEngine;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMapEngine(opt.id)}
                className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/15 text-foreground shadow-xs'
                    : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
                title={opt.description}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <span className="font-semibold text-foreground">{opt.label}</span>
                  <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-mono">
                    {opt.badge}
                  </Badge>
                </div>
                <span className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <hr className="border-border/60" />

      {/* Unterstützer-Box: Hallenkaffee & Transparenz */}
      <div className="rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent p-4 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <span>Gefällt dir HeimspielRadar?</span>
          <span role="img" aria-hidden="true" className="text-sm leading-none">
            ☕
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          Wir sind 100% werbefrei und Open Source. Hilf uns, die Server am Laufen zu halten!
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <a
            href={donationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/25 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span role="img" aria-hidden="true">
              ☕
            </span>
            <span>Einen Kaffee spendieren</span>
          </a>
          <span className="text-muted-foreground/50 select-none">•</span>
          <a
            href={transparencyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span role="img" aria-hidden="true">
              📊
            </span>
            <span>Finanzen einsehen (TRANSPARENCY.md)</span>
          </a>
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

  return (
    <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
      {filterFormContent}
    </div>
  );
}
