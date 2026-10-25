import * as React from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Coffee,
  MapPin,
  RotateCcw,
  Settings,
  SlidersHorizontal,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { FilterBar } from '@/components/filters/FilterBar';
import {
  VariantA_QuickFilterBar,
  VariantB_AccordionDrawer,
  VariantC_DesktopSidebar,
  VariantD_BottomBarSheet,
} from '@/components/filters/prototypes';
import { SettingsDialog } from '@/components/settings';
import {
  PrototypeSwitcher,
  type PrototypeVariant,
} from '@/components/prototype/PrototypeSwitcher';
import { MapContainer } from '@/components/map';
import { groupMatchesByVenue, isSameVenue } from '@/components/map/map-utils';
import { MatchList, VenueModal } from '@/components/matches';
import { ReloadPrompt } from '@/components/pwa';
import { ColdStartOverlay } from '@/components/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  compareMatchesChronologically,
  formatLastSyncedAt,
} from '@/lib/date-utils';
import { getDonationUrl } from '@/lib/donation';
import { useMatchFilters } from '@/lib/use-match-filters';
import { useLeagues, useMatches } from '@/lib/use-matches';
import { useServerHealth } from '@/lib/use-server-health';

const DONATION_URL = getDonationUrl();

function MainView() {
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
  const [isSettingsOpen, setIsSettingsOpen] = React.useState<boolean>(false);

  // Fallback: Support legacy FilterBar if ?legacy=true is present in URL
  const isLegacy = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return new URLSearchParams(window.location.search).get('legacy') === 'true';
  }, []);

  // Prototype Switcher pill: only display if ?prototypes, ?debug or ?switcher is in URL
  const showPrototypeSwitcher = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const params = new URLSearchParams(window.location.search);

    return params.has('prototypes') || params.has('debug') || params.has('switcher');
  }, []);

  // Prototype Variant selection: A (Quick-Filter), B (Accordion-Drawer), C (Desktop Sidebar), D (Hybrid Bottom-Bar + Sheet)
  const [currentVariant, setCurrentVariant] = React.useState<PrototypeVariant>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('variant');

      if (param === 'A' || param === 'B' || param === 'C' || param === 'D') {
        return param;
      }
    }

    return 'D';
  });

  const handleSelectVariant = React.useCallback((v: PrototypeVariant) => {
    setCurrentVariant(v);

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('variant', v);
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // Selected match for map marker / multi-match venue overlay (supports deep link ?matchId=)
  const [selectedMatchId, setSelectedMatchId] = React.useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const param = new URLSearchParams(window.location.search).get('matchId');

      if (param) {
        const id = Number(param);

        return Number.isFinite(id) ? id : null;
      }
    }

    return null;
  });

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
    teamQuery: filters.teamQuery,
    debounceMs: 300,
  });

  // Clear selectedMatchId if the selected match is no longer in the filtered results (after loading completes)
  React.useEffect(() => {
    if (
      selectedMatchId !== null &&
      !isLoading &&
      matches.length > 0 &&
      !matches.some((m) => m.id === selectedMatchId)
    ) {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId, isLoading]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null;

  // Group all matches by venue using canonical grouping logic
  const venueGroups = React.useMemo(
    () => groupMatchesByVenue(matches, selectedMatchId),
    [matches, selectedMatchId],
  );

  // Group all matches taking place at the selected match's venue, sorted chronologically
  const selectedVenueMatches = React.useMemo(() => {
    if (!selectedMatch?.venue) {
      return [];
    }

    const selectedGroup = venueGroups.find((g) => g.isSelected);

    if (selectedGroup) {
      return selectedGroup.matches;
    }

    return matches
      .filter((m) => isSameVenue(m, selectedMatch))
      .sort(compareMatchesChronologically);
  }, [matches, selectedMatch, venueGroups]);

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

        {/* Right: Actions (Hallenkaffee, Filter Trigger & Settings Gear Icon) */}
        <div className="flex items-center gap-2">
          {/* Hallenkaffee Donation Link */}
          <a
            href={DONATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Hallenkaffee spendieren (Serverkosten unterstützen)"
            aria-label="Hallenkaffee spendieren (Serverkosten unterstützen)"
            className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground shadow-xs transition-colors hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="text-sm leading-none" role="img" aria-hidden="true">
              ☕
            </span>
            <span className="hidden sm:inline">Hallenkaffee</span>
          </a>

          {isLegacy ? (
            /* Legacy Filter Trigger Button */
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
          ) : (
            <>
              {/* Active filter count badge in header for Variant D */}
              {currentVariant === 'D' && filters.activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsFilterDrawerOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition"
                  title="Aktive Filter bearbeiten"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>{filters.activeFilterCount} aktiv</span>
                </button>
              )}

              {/* Filter Drawer Trigger Button for Variants A, B, C */}
              {currentVariant !== 'D' && (
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
              )}

              {/* Settings Gear Button (User requested: oben rechts ein gear icon fuer 'Einstellungen') */}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                className="h-8 w-8 rounded-lg border-border/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Einstellungen"
                title="Einstellungen & Karten-Optionen"
              >
                <Settings className="h-4 w-4 text-slate-300" />
              </Button>
            </>
          )}
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
      <main className="relative flex flex-1 min-h-0 w-full flex-col md:flex-row overflow-hidden">
        {/* Variant C: Split-Sidebar on Desktop & Bottom-Sheet on Mobile */}
        {currentVariant === 'C' && (
          <VariantC_DesktopSidebar
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
        )}

        {/* Variant D: Hybrid Bottom-Bar + Bottom-Sheet + Desktop-Sidebar */}
        {!isLegacy && currentVariant === 'D' && (
          <VariantD_BottomBarSheet
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
            hasSelectedVenue={selectedMatch?.venue != null}
          />
        )}

        {filters.viewMode === 'map' ? (
          <div className="relative flex flex-1 min-h-0 h-full w-full flex-col">
            {/* Variant A: Floating Quick-Filter Pill Bar on Map */}
            {currentVariant === 'A' && (
              <VariantA_QuickFilterBar
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
            )}

            {/* Floating Map Summary Chip (Active in Legacy mode or Prototype Variants B & C) */}
            {(isLegacy || (currentVariant !== 'A' && currentVariant !== 'D')) && (
              <button
                type="button"
                onClick={() => setIsFilterDrawerOpen(true)}
                aria-label="Filter öffnen"
                title="Filter und Standort anpassen"
                className="absolute top-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto z-20 flex max-w-[calc(100%-4.5rem)] sm:max-w-[calc(100%-2rem)] items-center gap-1.5 sm:gap-2 rounded-full border border-slate-700/60 bg-slate-900/90 px-3 sm:px-3.5 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur-md transition-all hover:border-slate-500/80 hover:bg-slate-900 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {filters.teamQuery ? (
                  <>
                    <span className="shrink-0 text-sm leading-none">🏀</span>
                    <span className="truncate font-medium max-w-[150px] sm:max-w-xs">
                      {filters.teamQuery}
                    </span>
                    <span className="font-mono text-slate-400 shrink-0">
                      • {matches.length} {matches.length === 1 ? 'Spiel' : 'Spiele'}
                    </span>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </button>
            )}

            {/* Full-Bleed MapContainer */}
            <MapContainer
              matches={matches}
              venueGroups={venueGroups}
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
              teamQuery={filters.teamQuery}
              className="flex-1 h-full w-full min-h-0 rounded-none border-0 shadow-none"
              mapHeightClassName="w-full h-full"
            />

            {/* Cold-Start Map Overlay */}
            <ColdStartOverlay
              isVisible={isColdStarting && !isHealthDismissed}
              onDismiss={dismissColdStart}
            />

            {/* Venue Details Modal / Bottom Sheet (Zero overlap with bottom bar) */}
            <VenueModal
              selectedMatch={selectedMatch}
              venueMatches={selectedVenueMatches}
              onSelectMatch={(matchId) => setSelectedMatchId(matchId)}
              onClose={() => setSelectedMatchId(null)}
            />
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

      {/* Variant B: Accordion Drawer (when isOpen) */}
      {currentVariant === 'B' && (
        <VariantB_AccordionDrawer
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
      )}

      {/* Legacy FilterBar (Safety Fallback if ?legacy=true is requested) */}
      {isLegacy && (
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
      )}

      {/* Interactive Prototype Switcher Floating Pill (Only when requested via ?prototypes, ?debug or ?switcher) */}
      {showPrototypeSwitcher && (
        <PrototypeSwitcher
          currentVariant={currentVariant}
          onSelectVariant={handleSelectVariant}
        />
      )}

      {/* Settings & System Options Modal (Triggered by Header Gear Icon) */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        mapEngine={filters.mapEngine}
        onEngineChange={actions.setMapEngine}
        showRadiusCircle={filters.showRadiusCircle}
        onToggleRadiusCircle={actions.setShowRadiusCircle}
        viewMode={filters.viewMode}
        onViewModeChange={actions.setViewMode}
        lastSyncedAt={lastSyncedAt}
        matchCount={matches.length}
      />

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />
    </div>
  );
}

export function App() {
  const [isAdminRoute, setIsAdminRoute] = React.useState<boolean>(() => {
    return (
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/admin')
    );
  });

  React.useEffect(() => {
    const handlePopState = () => {
      setIsAdminRoute(window.location.pathname.startsWith('/admin'));
    };

    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  if (isAdminRoute) {
    const isAdminEnabled = import.meta.env.VITE_ENABLE_ADMIN_UI === 'true';

    if (!isAdminEnabled) {
      return (
        <div className="flex h-dvh w-full flex-col items-center justify-center bg-background px-4 text-center text-foreground">
          <h1 className="text-4xl font-extrabold tracking-tight">404</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Diese Seite konnte nicht gefunden werden.
          </p>
        </div>
      );
    }

    return <AdminDashboard />;
  }

  return <MainView />;
}
