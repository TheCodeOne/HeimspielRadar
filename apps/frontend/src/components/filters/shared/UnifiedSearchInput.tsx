import * as React from 'react';
import { Loader2, MapPin, Search, Trophy, X } from 'lucide-react';
import type { TeamSuggestion } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  type CitySuggestion,
  fetchPhotonGeocode,
  searchCuratedCities,
} from '@/lib/cities';
import type { LocationReference } from '@/lib/geo-utils';
import { getSampleMatches } from '@/lib/sample-matches';

export interface UnifiedSearchInputProps {
  location: LocationReference;
  teamQuery?: string;
  radiusKm: number;
  onSelectCity: (city: CitySuggestion) => void;
  onSelectTeam: (team: TeamSuggestion) => void;
  onSelectRawTeam?: (query: string) => void;
  onClearCity: () => void;
  onClearTeam: () => void;
  placeholder?: string;
  compact?: boolean;
  className?: string;
}

type SuggestionItem =
  | { kind: 'city'; item: CitySuggestion }
  | { kind: 'team'; item: TeamSuggestion };

export function UnifiedSearchInput({
  location,
  teamQuery,
  radiusKm,
  onSelectCity,
  onSelectTeam,
  onSelectRawTeam,
  onClearCity,
  onClearTeam,
  placeholder = 'Stadt, PLZ oder Verein suchen...',
  compact = false,
  className = '',
}: UnifiedSearchInputProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [localCitySuggestions, setLocalCitySuggestions] = React.useState<CitySuggestion[]>([]);
  const [onlineCitySuggestions, setOnlineCitySuggestions] = React.useState<CitySuggestion[]>([]);
  const [teamSuggestions, setTeamSuggestions] = React.useState<TeamSuggestion[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = React.useState(false);
  const [isSearchingTeams, setIsSearchingTeams] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter curated cities instantly + debounce online Photon geocoding
  React.useEffect(() => {
    const q = searchQuery.trim();

    if (!q) {
      setLocalCitySuggestions([]);
      setOnlineCitySuggestions([]);
      setIsSearchingOnline(false);

      return;
    }

    const local = searchCuratedCities(q, 5);

    setLocalCitySuggestions(local);

    if (q.length < 3) {
      setOnlineCitySuggestions([]);
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

        setOnlineCitySuggestions(results);
      } catch {
        setOnlineCitySuggestions([]);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 350);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, location.lat, location.lng]);

  // Debounced search for team suggestions
  React.useEffect(() => {
    const q = searchQuery.trim();

    if (!q) {
      setTeamSuggestions([]);
      setIsSearchingTeams(false);

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

        setTeamSuggestions(deduped.slice(0, 8));
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

        setTeamSuggestions(localMatches.slice(0, 8));
      } finally {
        setIsSearchingTeams(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  // Merge & deduplicate local and online city results
  const allCitySuggestions = React.useMemo(() => {
    const uniqueOnline = onlineCitySuggestions.filter((online) => {
      const onlineLower = online.name.trim().toLowerCase();

      return !localCitySuggestions.some((local) => {
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

    return [...localCitySuggestions, ...uniqueOnline];
  }, [localCitySuggestions, onlineCitySuggestions]);

  // Combined flat list of selectable items for unified keyboard navigation
  const combinedItems: SuggestionItem[] = React.useMemo(() => {
    const items: SuggestionItem[] = [];

    for (const city of allCitySuggestions) {
      items.push({ kind: 'city', item: city });
    }

    for (const team of teamSuggestions) {
      items.push({ kind: 'team', item: team });
    }

    return items;
  }, [allCitySuggestions, teamSuggestions]);

  // Reset highlight index when query or results change
  React.useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

  const handleCityClick = React.useCallback(
    (item: CitySuggestion) => {
      onSelectCity(item);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setLocalCitySuggestions([]);
      setOnlineCitySuggestions([]);
      setTeamSuggestions([]);
    },
    [onSelectCity],
  );

  const handleTeamClick = React.useCallback(
    (suggestion: TeamSuggestion) => {
      onSelectTeam(suggestion);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setLocalCitySuggestions([]);
      setOnlineCitySuggestions([]);
      setTeamSuggestions([]);
    },
    [onSelectTeam],
  );

  const handleClearSearch = React.useCallback(() => {
    setSearchQuery('');
    setIsDropdownOpen(false);
    setLocalCitySuggestions([]);
    setOnlineCitySuggestions([]);
    setTeamSuggestions([]);
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const q = searchQuery.trim();

    if (!q) {
      return;
    }

    if (highlightedIndex >= 0 && combinedItems[highlightedIndex]) {
      const selected = combinedItems[highlightedIndex];

      if (selected.kind === 'city') {
        handleCityClick(selected.item);
      } else {
        handleTeamClick(selected.item);
      }

      return;
    }

    if (combinedItems.length > 0) {
      const first = combinedItems[0];

      if (first.kind === 'city') {
        handleCityClick(first.item);
      } else {
        handleTeamClick(first.item);
      }

      return;
    }

    // Try online Photon geocode if user pressed Enter
    setIsSearchingOnline(true);

    try {
      const results = await fetchPhotonGeocode(q, {
        lat: location.lat,
        lng: location.lng,
      });

      if (results.length > 0) {
        handleCityClick(results[0]);

        return;
      }
    } finally {
      setIsSearchingOnline(false);
    }

    // Fallback: apply as raw team query
    if (onSelectRawTeam) {
      onSelectRawTeam(q);
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsDropdownOpen(true);

      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < combinedItems.length - 1 ? prev + 1 : 0,
      );

      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : combinedItems.length - 1,
      );

      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSearchSubmit();

      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setIsDropdownOpen(false);

      return;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isDropdownOpen}
            aria-controls="unified-search-listbox"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0 || combinedItems.length > 0) {
                setIsDropdownOpen(true);
              }
            }}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            aria-label="Stadt, Postleitzahl oder Verein suchen"
            className={`w-full rounded-md border border-input bg-background/80 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
              compact ? 'h-8 py-1' : ''
            }`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Suche zurücksetzen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!compact && (
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={
              (isSearchingOnline || isSearchingTeams) && !searchQuery.trim()
            }
            className="h-8 px-2.5 text-xs font-medium shrink-0"
          >
            {isSearchingOnline || isSearchingTeams ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              'Suchen'
            )}
          </Button>
        )}
      </form>

      {/* Autocomplete Dropdown with 2 Grouped Sections */}
      {isDropdownOpen &&
        (combinedItems.length > 0 ||
          isSearchingOnline ||
          isSearchingTeams ||
          (searchQuery.trim().length >= 2 &&
            !isSearchingOnline &&
            !isSearchingTeams &&
            combinedItems.length === 0)) && (
          <div
            id="unified-search-listbox"
            role="listbox"
            aria-label="Suchvorschläge für Orte und Vereine"
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-md"
          >
            {/* Section 1: 📍 Städte & Orte */}
            {(allCitySuggestions.length > 0 || isSearchingOnline) && (
              <div>
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-primary" />
                    Städte & Orte
                  </span>
                  {isSearchingOnline && (
                    <span className="flex items-center gap-1 text-[10px] font-normal lowercase">
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                      sucht online...
                    </span>
                  )}
                </div>

                {allCitySuggestions.map((city) => {
                  const itemIndex = combinedItems.findIndex(
                    (it) => it.kind === 'city' && it.item === city,
                  );

                  const isSelected = itemIndex === highlightedIndex;

                  return (
                    <button
                      key={`city-${city.name}-${city.lat}-${city.lng}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleCityClick(city)}
                      onMouseEnter={() => setHighlightedIndex(itemIndex)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="truncate">{city.name}</span>
                        {city.state && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {city.state}
                          </span>
                        )}
                      </div>

                      {city.postalCodes.length > 0 && (
                        <span className="ml-2 font-mono text-[10px] text-muted-foreground shrink-0">
                          PLZ {city.postalCodes[0]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Section 2: 🏀 Vereine & Teams */}
            {(teamSuggestions.length > 0 || isSearchingTeams) && (
              <div
                className={
                  allCitySuggestions.length > 0 || isSearchingOnline
                    ? 'mt-2 pt-1 border-t border-border/40'
                    : ''
                }
              >
                <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Trophy className="h-3 w-3 text-primary" />
                    Vereine & Teams
                  </span>
                  {isSearchingTeams && (
                    <span className="flex items-center gap-1 text-[10px] font-normal lowercase">
                      <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                      sucht Teams...
                    </span>
                  )}
                </div>

                {teamSuggestions.map((team) => {
                  const itemIndex = combinedItems.findIndex(
                    (it) => it.kind === 'team' && it.item === team,
                  );

                  const isSelected = itemIndex === highlightedIndex;

                  return (
                    <button
                      key={`team-${team.id}-${team.name}-${team.akName ?? ''}-${team.geschlecht ?? ''}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleTeamClick(team)}
                      onMouseEnter={() => setHighlightedIndex(itemIndex)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-sm shrink-0">🏀</span>
                        <span className="truncate font-medium">
                          {team.name}
                        </span>
                        {team.shortName && team.shortName !== team.name && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({team.shortName})
                          </span>
                        )}
                      </div>

                      {(team.akName || team.geschlecht) && (
                        <span className="rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground shrink-0">
                          {[team.akName, team.geschlecht].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Empty State */}
            {!isSearchingOnline &&
              !isSearchingTeams &&
              combinedItems.length === 0 &&
              searchQuery.trim().length >= 2 && (
                <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">
                  Keine Treffer für &ldquo;{searchQuery}&rdquo;.
                </div>
              )}
          </div>
        )}

      {/* Active Selection Chip: Exclusive (either Team OR City) */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <span className="text-[11px] text-muted-foreground">Aktiver Filter:</span>
        {teamQuery ? (
          <Badge
            variant="default"
            className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs py-0.5 px-2.5 shadow-xs"
            data-testid="active-team-chip"
          >
            <span>🏀 {teamQuery}</span>
            <button
              type="button"
              onClick={onClearTeam}
              className="ml-1 rounded hover:bg-primary-foreground/20 p-0.5 text-primary-foreground transition-colors"
              aria-label="Vereinsfilter entfernen"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="flex items-center gap-1.5 text-xs py-0.5 px-2.5 shadow-xs border border-border/80"
            data-testid="active-location-chip"
          >
            <span>📍 {location.name || 'Stuttgart'} (Radius: {radiusKm} km)</span>
            <button
              type="button"
              onClick={onClearCity}
              className="ml-1 rounded hover:bg-muted-foreground/20 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Ortsfilter auf Stuttgart zurücksetzen"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>
    </div>
  );
}
