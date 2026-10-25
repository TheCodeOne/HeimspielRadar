import * as React from 'react';
import { Loader2, Search, X } from 'lucide-react';
import type { TeamSuggestion } from '@sundayleague/shared-types';
import { getSampleMatches } from '@/lib/sample-matches';
import { Button } from '@/components/ui/button';

export interface TeamSearchInputProps {
  value: string;
  onSelectSuggestion: (suggestion: TeamSuggestion) => void;
  onSelectRawQuery?: (query: string) => void;
  onClear: () => void;
  placeholder?: string;
  compact?: boolean;
}

export function TeamSearchInput({
  value,
  onSelectSuggestion,
  onSelectRawQuery,
  onClear,
  placeholder = 'Verein / Team suchen (z.B. SV Pfrondorf)...',
  compact = false,
}: TeamSearchInputProps) {
  const [inputValue, setInputValue] = React.useState(value || '');
  const [teamSuggestions, setTeamSuggestions] = React.useState<TeamSuggestion[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync external value
  React.useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Click outside to close
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

  // Debounced search
  React.useEffect(() => {
    const q = inputValue.trim();

    if (!q) {
      setTeamSuggestions([]);
      setIsSearching(false);
      setHighlightedIndex(-1);

      return;
    }

    const controller = new AbortController();

    setIsSearching(true);

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

        // Deduplication across (name + akName + geschlecht)
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
        setIsSearching(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [inputValue]);

  const handleSelect = (suggestion: TeamSuggestion) => {
    setInputValue(suggestion.name);
    setIsDropdownOpen(false);
    onSelectSuggestion(suggestion);
  };

  const handleClear = () => {
    setInputValue('');
    setTeamSuggestions([]);
    setIsDropdownOpen(false);
    onClear();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (highlightedIndex >= 0 && teamSuggestions[highlightedIndex]) {
      handleSelect(teamSuggestions[highlightedIndex]);
    } else if (inputValue.trim()) {
      setIsDropdownOpen(false);

      if (onSelectRawQuery) {
        onSelectRawQuery(inputValue.trim());
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => {
              if (inputValue.trim()) {
                setIsDropdownOpen(true);
              }
            }}
            placeholder={placeholder}
            className={`w-full rounded-md border border-input bg-background/80 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
              compact ? 'h-8 py-1' : ''
            }`}
          />
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Zurücksetzen"
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
            disabled={isSearching || !inputValue.trim()}
            className="h-8 px-2.5 text-xs font-medium shrink-0"
          >
            {isSearching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              'Filtern'
            )}
          </Button>
        )}
      </form>

      {/* Autocomplete Dropdown */}
      {isDropdownOpen &&
        (teamSuggestions.length > 0 ||
          isSearching ||
          (inputValue.trim().length >= 2 &&
            !isSearching &&
            teamSuggestions.length === 0)) && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-xl backdrop-blur-md"
          >
            {teamSuggestions.map((suggestion, idx) => {
              const isSelected = idx === highlightedIndex;

              return (
                <button
                  key={`${suggestion.id}-${suggestion.name}-${suggestion.akName ?? ''}-${suggestion.geschlecht ?? ''}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(suggestion)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
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

            {isSearching && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                <span>Suche Teams...</span>
              </div>
            )}

            {!isSearching &&
              teamSuggestions.length === 0 &&
              inputValue.trim().length >= 2 && (
                <div className="px-2.5 py-2 text-center text-xs text-muted-foreground">
                  Kein Team gefunden für &ldquo;{inputValue}&rdquo;.
                </div>
              )}
          </div>
        )}
    </div>
  );
}
