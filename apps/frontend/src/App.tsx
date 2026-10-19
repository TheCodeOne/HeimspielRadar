import * as React from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Coffee,
  ExternalLink,
  MapPin,
  RotateCcw,
  SlidersHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { FilterBar } from '@/components/filters';
import { MapContainer } from '@/components/map';
import { formatLeagueName } from '@/components/map/map-utils';
import { MatchList } from '@/components/matches';
import { ReloadPrompt } from '@/components/pwa';
import { ColdStartOverlay } from '@/components/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  compareMatchesChronologically,
  formatDisplayDate,
  formatKickoffTime,
  formatLastSyncedAt,
} from '@/lib/date-utils';
import { formatDistance } from '@/lib/geo-utils';
import { useMatchFilters } from '@/lib/use-match-filters';
import { useLeagues, useMatches } from '@/lib/use-matches';
import { useServerHealth } from '@/lib/use-server-health';

function isSameVenue(a: Match, b: Match): boolean {
  if (!a.venue || !b.venue) {
    return false;
  }

  if (a.venue.id === b.venue.id) {
    return true;
  }

  return (
    a.venue.latitude != null &&
    a.venue.longitude != null &&
    a.venue.latitude === b.venue.latitude &&
    a.venue.longitude === b.venue.longitude
  );
}

function buildGoogleMapsRouteUrl(match: Match): string {
  const venue = match.venue;

  if (!venue) {
    return 'https://www.google.com/maps';
  }

  const destination =
    venue.latitude != null && venue.longitude != null
      ? `${venue.latitude},${venue.longitude}`
      : `${venue.name}, ${venue.street}, ${venue.postalCode} ${venue.city}`;

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function App() {
  // Fetch available leagues and distinct hierarchy options from /api/leagues
  const {
    leagues,
    genders: availableGenders,
    ageClasses: availableAgeClasses,
    skillLevels: availableSkillLevels,
  } = useLeagues();

  // Deep match filters and location controller module
  const { filters, actions } = useMatchFilters({
    leagues,
  });

  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = React.useState<boolean>(false);

  // Selected match for map marker / multi-match venue overlay
  const [selectedMatchId, setSelectedMatchId] = React.useState<number | null>(null);

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Handle location error feedback
  React.useEffect(() => {
    if (filters.locationError) {
      setToastMessage(filters.locationError);
      const timer = setTimeout(() => setToastMessage(null), 6000);

      return () => clearTimeout(timer);
    }
  }, [filters.locationError]);

  const handleLocateUser = async () => {
    const loc = await actions.locateUser();

    if (loc) {
      setSelectedMatchId(null);
      setToastMessage('Standort ermittelt: Karte zentriert');
      const timer = setTimeout(() => setToastMessage(null), 3000);

      return () => clearTimeout(timer);
    }
  };

  // Server health and cold-start detection
  const {
    isColdStarting,
    isDismissed: isHealthDismissed,
    dismiss: dismissColdStart,
    lastSyncedAt,
  } = useServerHealth({ thresholdMs: 1500 });

  // Query matches with debounced API integration and hierarchical filter params
  const { matches, isLoading } = useMatches({
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    lat: filters.location.lat,
    lng: filters.location.lng,
    radiusKm: filters.radiusKm,
    leagueIds: filters.leagueIds.length > 0 ? filters.leagueIds : undefined,
    genders: filters.genders.length > 0 ? filters.genders : undefined,
    ageClasses: filters.ageClasses.length > 0 ? filters.ageClasses : undefined,
    skillLevels: filters.skillLevels.length > 0 ? filters.skillLevels : undefined,
    onlyUpcoming: filters.onlyUpcoming,
    debounceMs: 300,
  });

  // Clear selectedMatchId if the selected match is no longer in the filtered results
  React.useEffect(() => {
    if (selectedMatchId !== null && !matches.some((m) => m.id === selectedMatchId)) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null;

  // Group all matches taking place at the selected match's venue, sorted chronologically
  const selectedVenueMatches = React.useMemo(() => {
    if (!selectedMatch?.venue) {
      return [];
    }

    return matches
      .filter((m) => isSameVenue(m, selectedMatch))
      .sort(compareMatchesChronologically);
  }, [matches, selectedMatch]);

  // Handle marker click on map
  const handleMarkerClick = (match: Match) => {
    setSelectedMatchId(match.id);
  };

  // Reset all filters to default while preserving current viewMode and mapEngine
  const handleResetFilters = () => {
    actions.resetFilters();
  };

  // Expand radius helper for empty state
  const handleExpandRadius = () => {
    actions.expandRadius(15);
  };

  // Center coordinate for map view: center on selected match venue or user reference point
  const mapCenter: [number, number] =
    selectedMatch?.venue?.latitude != null && selectedMatch?.venue?.longitude != null
      ? [selectedMatch.venue.latitude, selectedMatch.venue.longitude]
      : [filters.location.lat, filters.location.lng];

  return (
    <div className="fixed inset-0 flex h-dvh w-full flex-col overflow-hidden overscroll-none bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Unified Application Header (Desktop & Mobile) */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/80 bg-background/95 px-3 backdrop-blur-md sm:px-6">
        {/* Left: Brand Logo & Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card shadow-xs">
            <Activity className="h-4 w-4 text-primary" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold tracking-tight text-base sm:text-lg text-slate-100 flex items-center gap-2">
              HeimspielRadar
            </span>
            <Badge variant="outline" className="hidden text-[10px] lg:inline-flex">
              Amateur-Basketball
            </Badge>
            <Badge
              variant="outline"
              className="hidden text-[10px] font-mono text-muted-foreground xl:inline-flex border-border/60 bg-muted/30"
              title={lastSyncedAt ? `Letzte DBB-Synchronisierung: ${lastSyncedAt}` : undefined}
            >
              <Clock className="mr-1 h-3 w-3 text-primary/70" />
              {formatLastSyncedAt(lastSyncedAt)}
            </Badge>
          </div>
        </div>

        {/* Right: Filter Drawer Trigger Button with Active Count Badge */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsFilterDrawerOpen(true)}
            className="h-8 gap-1.5 px-2.5 text-xs font-medium sm:px-3"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
            <span>Filter</span>
            {filters.activeFilterCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-bold text-primary-foreground">
                {filters.activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Feedback Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
        >
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-muted-foreground hover:text-foreground text-xs"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area: Full-Screen Map View OR Full-Screen List View */}
      <main className="relative flex flex-1 min-h-0 w-full flex-col overflow-hidden">
        {filters.viewMode === 'map' ? (
          <div className="relative flex flex-1 min-h-0 h-full w-full flex-col">
            {/* Floating Map Summary Chip (Interactive, Responsive & High-Contrast) */}
            <button
              type="button"
              onClick={() => setIsFilterDrawerOpen(true)}
              aria-label="Filter öffnen"
              title="Filter und Standort anpassen"
              className="absolute top-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-20 flex max-w-[calc(100%-4.5rem)] sm:max-w-[calc(100%-2rem)] items-center gap-1.5 sm:gap-2 rounded-full border border-slate-700/60 bg-slate-900/90 px-3 sm:px-3.5 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur-md transition-all hover:border-slate-500/80 hover:bg-slate-900 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate font-medium max-w-[150px] sm:max-w-xs">
                {filters.location.name}
              </span>
              <span className="font-mono text-slate-400 shrink-0">
                • {filters.radiusKm} km
              </span>
              <span className="hidden text-slate-400 sm:inline shrink-0">
                • {filters.dateRangeDisplay}
              </span>
              <Badge
                variant="outline"
                className="ml-0.5 shrink-0 border-slate-700/80 bg-slate-800/80 font-mono text-[10px] text-slate-200"
              >
                {matches.length} {matches.length === 1 ? 'Spiel' : 'Spiele'}
              </Badge>
            </button>

            {/* Full-Bleed MapContainer */}
            <MapContainer
              matches={matches}
              selectedMatchId={selectedMatchId}
              center={mapCenter}
              zoom={9}
              userLocation={filters.userCoords ? [filters.userCoords.lat, filters.userCoords.lng] : null}
              searchLocation={filters.location}
              radiusKm={filters.radiusKm}
              showRadiusCircle={filters.showRadiusCircle}
              onMarkerClick={handleMarkerClick}
              onLocateUser={handleLocateUser}
              isLocating={filters.isLocating}
              engine={filters.mapEngine}
              onEngineChange={actions.setMapEngine}
              className="flex-1 h-full w-full min-h-0 rounded-none border-0 shadow-none"
              mapHeightClassName="w-full h-full"
            />

            {/* Cold-Start Map Overlay */}
            <ColdStartOverlay
              isVisible={isColdStarting && !isHealthDismissed}
              onDismiss={dismissColdStart}
            />

            {/* Multi-Match Venue Overlay Card at Bottom of Full-Screen Map */}
            {selectedMatch?.venue && (
              <div className="absolute bottom-4 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur-md">
                {/* Venue Header */}
                <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 shrink-0 text-primary" />
                      <h3 className="truncate text-sm font-bold text-foreground">
                        {selectedMatch.venue.name}
                      </h3>
                      {selectedMatch.distanceKm != null && (
                        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                          {formatDistance(selectedMatch.distanceKm)}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selectedMatch.venue.street}, {selectedMatch.venue.postalCode}{' '}
                      {selectedMatch.venue.city}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={buildGoogleMapsRouteUrl(selectedMatch)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      title="Route in Google Maps öffnen"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Route</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setSelectedMatchId(null)}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label="Hallen-Details schließen"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scrollable List of All Matches at This Venue */}
                <div className="mt-2.5">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>
                      {selectedVenueMatches.length}{' '}
                      {selectedVenueMatches.length === 1
                        ? 'Heimspiel in dieser Halle'
                        : 'Heimspiele in dieser Halle'}
                    </span>
                  </div>

                  <div className="max-h-48 space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {selectedVenueMatches.map((venueMatch) => {
                      const isActiveMatch = venueMatch.id === selectedMatch.id;

                      const matchLeagueName = formatLeagueName(
                        venueMatch.leagueId,
                        venueMatch.league?.name,
                      );

                      const categoryBadge = [
                        venueMatch.league?.akName,
                        venueMatch.league?.geschlecht,
                      ]
                        .filter(Boolean)
                        .join(' • ');

                      return (
                        <div
                          key={venueMatch.id}
                          onClick={() => setSelectedMatchId(venueMatch.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSelectedMatchId(venueMatch.id);
                            }
                          }}
                          className={`cursor-pointer rounded-lg border p-2.5 text-xs transition-colors ${
                            isActiveMatch
                              ? 'border-primary/60 bg-primary/10'
                              : 'border-border/60 bg-card/60 hover:border-primary/40'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="league" className="text-[10px]">
                                <Trophy className="mr-1 h-2.5 w-2.5" />
                                {matchLeagueName}
                              </Badge>
                              {categoryBadge && (
                                <Badge variant="outline" className="text-[10px]">
                                  {categoryBadge}
                                </Badge>
                              )}
                            </div>

                            <span className="font-mono text-[11px] font-medium text-foreground">
                              {formatDisplayDate(venueMatch.kickoffDate)} •{' '}
                              {formatKickoffTime(venueMatch.kickoffTime)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center justify-between gap-2 font-semibold text-foreground">
                            <span className="truncate">{venueMatch.homeTeam.name}</span>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              vs.
                            </span>
                            <span className="truncate text-right">
                              {venueMatch.guestTeam.name}
                            </span>
                          </div>

                          {venueMatch.result && (
                            <div className="mt-1 text-right font-mono text-[11px] font-bold text-primary">
                              Endstand: {venueMatch.result}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Full-Screen Scrollable List View */
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
            <div className="mx-auto max-w-4xl space-y-4">
              {isColdStarting && !isHealthDismissed && (
                <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 shrink-0 animate-pulse text-primary" />
                    <span>☕ Kostenloser Server wacht auf (~30 Sek.)...</span>
                  </div>
                  <button
                    type="button"
                    onClick={dismissColdStart}
                    className="shrink-0 text-[11px] text-muted-foreground underline hover:text-foreground"
                  >
                    Ausblenden
                  </button>
                </div>
              )}

              {/* Active Filter Summary Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-card/60 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="gap-1 font-medium">
                    <MapPin className="h-3 w-3 text-primary" />
                    {filters.location.name} ({filters.radiusKm} km)
                  </Badge>

                  <Badge variant="outline" className="gap-1 font-medium">
                    <Calendar className="h-3 w-3 text-primary" />
                    {filters.dateRangeDisplay}
                  </Badge>

                  {filters.onlyUpcoming && (
                    <Badge variant="outline" className="text-[11px]">
                      Nur anstehende Spiele
                    </Badge>
                  )}

                  {filters.genders.map((g) => (
                    <Badge key={`g-${g}`} variant="secondary" className="text-[11px]">
                      {g}
                    </Badge>
                  ))}

                  {filters.ageClasses.map((ak) => (
                    <Badge key={`ak-${ak}`} variant="secondary" className="text-[11px]">
                      {ak}
                    </Badge>
                  ))}

                  {filters.skillLevels.map((sk) => (
                    <Badge key={`sk-${sk}`} variant="secondary" className="text-[11px]">
                      {sk}
                    </Badge>
                  ))}

                  {filters.leagueIds.length > 0 && (
                    <Badge variant="secondary" className="text-[11px]">
                      {filters.leagueIds.length} {filters.leagueIds.length === 1 ? 'Liga' : 'Ligen'}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {filters.activeFilterCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetFilters}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Zurücksetzen
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className="h-7 text-xs"
                  >
                    <SlidersHorizontal className="mr-1.5 h-3 w-3 text-primary" />
                    Filter anpassen
                  </Button>
                </div>
              </div>

              {/* Match List Header Status */}
              <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>
                  <strong className="text-foreground">{matches.length}</strong>{' '}
                  {matches.length === 1 ? 'Heimspiel' : 'Heimspiele'} im Umkreis von{' '}
                  {filters.radiusKm} km
                </span>
              </div>

              <MatchList
                matches={matches}
                selectedMatchId={selectedMatchId}
                onSelectMatch={(match) => {
                  setSelectedMatchId(match.id);
                  actions.setViewMode('map');
                }}
                onHoverMatch={(match) => setSelectedMatchId(match.id)}
                isLoading={isLoading}
                radiusKm={filters.radiusKm}
                onExpandRadius={handleExpandRadius}
                onResetFilters={handleResetFilters}
              />
            </div>
          </div>
        )}
      </main>

      {/* Slide-Over Filter Drawer */}
      <FilterBar
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        filters={filters}
        availableOptions={{
          leagues,
          genders: availableGenders,
          ageClasses: availableAgeClasses,
          skillLevels: availableSkillLevels,
          matchCount: matches.length,
          lastSyncedAt,
        }}
        actions={actions}
      />

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />
    </div>
  );
}
