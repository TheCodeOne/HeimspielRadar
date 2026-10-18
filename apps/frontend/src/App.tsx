import * as React from 'react';
import {
  Activity,
  Calendar,
  Clock,
  Coffee,
  Compass,
  MapPin,
  Navigation,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { FilterBar } from '@/components/filters';
import { MapContainer } from '@/components/map';
import { MatchCard, MatchList } from '@/components/matches';
import { ReloadPrompt } from '@/components/pwa';
import { ColdStartOverlay } from '@/components/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGeolocation } from '@/hooks/useGeolocation';
import {
  formatDisplayDate,
  formatLastSyncedAt,
  getThisWeekendSaturdayString,
  getTodayString,
} from '@/lib/date-utils';
import {
  type LocationReference,
  STUTTGART_FALLBACK,
} from '@/lib/geo-utils';
import { useMatches } from '@/lib/use-matches';
import { useServerHealth } from '@/lib/use-server-health';

export function App() {
  // Filter state
  const [selectedDate, setSelectedDate] = React.useState<string>(getTodayString());
  const [radiusKm, setRadiusKm] = React.useState<number>(30);
  const [location, setLocation] = React.useState<LocationReference>(STUTTGART_FALLBACK);
  const [selectedLeagueId, setSelectedLeagueId] = React.useState<number | undefined>(undefined);

  // Mobile navigation tab: 'list' or 'map'
  const [mobileTab, setMobileTab] = React.useState<'list' | 'map'>('list');

  // Selected match for bi-directional map/card synchronization
  const [selectedMatchId, setSelectedMatchId] = React.useState<number | null>(null);

  // User Geolocation hook integration
  const {
    location: geoCoords,
    error: geoError,
    loading: isLocating,
    requestLocation,
  } = useGeolocation();

  const [toastMessage, setToastMessage] = React.useState<string | null>(null);

  // Sync cold-start stored coordinates if available
  React.useEffect(() => {
    if (geoCoords && location.name === STUTTGART_FALLBACK.name) {
      setLocation({
        lat: geoCoords.lat,
        lng: geoCoords.lng,
        name: 'Mein Standort',
      });
    }
  }, [geoCoords]);

  // Handle geolocation error feedback
  React.useEffect(() => {
    if (geoError) {
      setToastMessage(geoError);
      const timer = setTimeout(() => setToastMessage(null), 6000);

      return () => clearTimeout(timer);
    }
  }, [geoError]);

  const handleLocateUser = async () => {
    const coords = await requestLocation();

    if (coords) {
      setLocation({
        lat: coords.lat,
        lng: coords.lng,
        name: 'Mein Standort',
      });
      setSelectedMatchId(null);
      setToastMessage('Standort ermittelt: Karte zentriert');
      const timer = setTimeout(() => setToastMessage(null), 3000);

      return () => clearTimeout(timer);
    }

    setLocation(STUTTGART_FALLBACK);
  };
  // Server health and cold-start detection
  const {
    isColdStarting,
    isDismissed: isHealthDismissed,
    dismiss: dismissColdStart,
    lastSyncedAt,
  } = useServerHealth({ thresholdMs: 1500 });

  // Query matches with debounced API integration
  const { matches, isLoading } = useMatches({
    date: selectedDate || undefined,
    lat: location.lat,
    lng: location.lng,
    radiusKm,
    leagueId: selectedLeagueId,
    debounceMs: 300,
  });

  // Keep selectedMatchId valid when matches update
  React.useEffect(() => {
    if (matches.length > 0) {
      const matchStillExists = matches.some((m) => m.id === selectedMatchId);

      if (!matchStillExists) {
        setSelectedMatchId(matches[0].id);
      }
    } else {
      setSelectedMatchId(null);
    }
  }, [matches, selectedMatchId]);

  const selectedMatch = matches.find((m) => m.id === selectedMatchId) ?? null;

  // Handle marker click on map
  const handleMarkerClick = (match: Match) => {
    setSelectedMatchId(match.id);
  };

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedDate('');
    setRadiusKm(30);
    setLocation(STUTTGART_FALLBACK);
    setSelectedLeagueId(undefined);
  };

  // Expand radius helper for empty state
  const handleExpandRadius = () => {
    setRadiusKm((current) => Math.min(50, current + 15));
  };

  // Center coordinate for map view: center on selected match venue or user reference point
  const mapCenter: [number, number] =
    selectedMatch?.venue?.latitude != null && selectedMatch?.venue?.longitude != null
      ? [selectedMatch.venue.latitude, selectedMatch.venue.longitude]
      : [location.lat, location.lng];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-md sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-xs">
            <Activity className="h-4 w-4 text-primary" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-sm sm:text-base">
                HeimspielRadar
              </span>
              <Badge variant="outline" className="hidden text-[10px] sm:inline-flex">
                Amateur-Basketball
              </Badge>
              <Badge
                variant="outline"
                className="hidden text-[10px] font-mono text-muted-foreground md:inline-flex border-border/60 bg-muted/30"
                title={lastSyncedAt ? `Letzte DBB-Synchronisierung: ${lastSyncedAt}` : undefined}
              >
                <Clock className="mr-1 h-3 w-3 text-primary/70" />
                {formatLastSyncedAt(lastSyncedAt)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Header Indicators / Quick Info */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedDate(getThisWeekendSaturdayString())}
            className="hidden text-xs sm:inline-flex"
            title="Auf dieses Wochenende filtern"
          >
            <Calendar className="mr-1.5 h-3.5 w-3.5 text-primary" />
            <span>{formatDisplayDate(selectedDate)}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setMobileTab(mobileTab === 'list' ? 'map' : 'list')}
            className="text-xs font-mono"
          >
            <Navigation className="mr-1.5 h-3.5 w-3.5 text-primary" />
            <span>
              {location.name} + {radiusKm}km
            </span>
          </Button>
        </div>
      </header>

      {/* Feedback Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-lg border border-border/80 bg-background/95 px-4 py-2 text-xs text-foreground shadow-lg backdrop-blur-md"
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

      {/* Main Layout Area */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* ======================================================== */}
        {/* DESKTOP SPLIT-SCREEN VIEW (>= 1024px)                     */}
        {/* ======================================================== */}
        <div className="hidden lg:flex w-full h-full min-h-0">
          {/* Left Pane: Sticky Filter Bar + Scrollable Match Cards */}
          <aside className="w-[440px] xl:w-[480px] 2xl:w-[520px] shrink-0 border-r border-border/80 bg-background/50 flex flex-col h-full min-h-0">
            {/* Filter Controls (Sticky in left pane) */}
            <div className="p-4 border-b border-border/60 bg-card/40 shrink-0">
              <FilterBar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                location={location}
                onLocationChange={setLocation}
                selectedLeagueId={selectedLeagueId}
                onLeagueChange={setSelectedLeagueId}
                onResetFilters={handleResetFilters}
                onRequestLocation={handleLocateUser}
                isLocating={isLocating}
                lastSyncedAt={lastSyncedAt}
                className="border-0 bg-transparent p-0 shadow-none"
              />
            </div>

            {/* Match List Header Status */}
            <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">
                  {matches.length}
                </span>
                <span>
                  {matches.length === 1 ? 'Heimspiel' : 'Heimspiele'} im Umkreis von {radiusKm} km
                </span>
              </div>

              {selectedDate && (
                <button
                  type="button"
                  onClick={() => setSelectedDate('')}
                  className="text-[11px] text-primary hover:underline"
                >
                  Alle Daten
                </button>
              )}
            </div>

            {/* Scrollable Match List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scroll-smooth">
              <MatchList
                matches={matches}
                selectedMatchId={selectedMatchId}
                onSelectMatch={(match) => setSelectedMatchId(match.id)}
                onHoverMatch={(match) => setSelectedMatchId(match.id)}
                isLoading={isLoading}
                radiusKm={radiusKm}
                onExpandRadius={handleExpandRadius}
                onResetFilters={handleResetFilters}
              />
            </div>
          </aside>

          {/* Right Pane: Full-Height Interactive Map Container */}
          <section className="flex-1 h-full min-h-0 relative flex flex-col bg-muted/10">
            <div className="h-full w-full flex-1 min-h-0 flex flex-col">
              <MapContainer
                matches={matches}
                selectedMatchId={selectedMatchId}
                center={mapCenter}
                zoom={9}
                userLocation={geoCoords ? [geoCoords.lat, geoCoords.lng] : null}
                onMarkerClick={handleMarkerClick}
                onLocateUser={handleLocateUser}
                isLocating={isLocating}
                className="h-full w-full flex-1 min-h-0 rounded-none border-0 shadow-none"
                mapHeightClassName="w-full h-full min-h-[500px]"
              />
            </div>

            {/* Cold-Start Map Overlay (Desktop) */}
            <ColdStartOverlay
              isVisible={isColdStarting && !isHealthDismissed}
              onDismiss={dismissColdStart}
            />

            {/* Floating Venue Quick Card Preview (Overlay on Map) */}
            {selectedMatch?.venue && (
              <div className="absolute bottom-6 right-6 z-20 w-80 rounded-xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>Austragungsort</span>
                  </div>

                  <span className="font-mono text-[11px] font-medium text-primary">
                    {selectedMatch.distanceKm} km
                  </span>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="font-semibold text-foreground">
                    {selectedMatch.venue.name}
                  </div>
                  <div className="text-muted-foreground">
                    {selectedMatch.venue.street}, {selectedMatch.venue.postalCode}{' '}
                    {selectedMatch.venue.city}
                  </div>
                  <div className="pt-2 text-[11px] text-muted-foreground flex justify-between items-center border-t border-border/30">
                    <span>
                      {selectedMatch.homeTeam.name} vs. {selectedMatch.guestTeam.name}
                    </span>
                    <span className="font-mono font-medium text-foreground">
                      {selectedMatch.kickoffTime} Uhr
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ======================================================== */}
        {/* MOBILE VIEW (< 1024px) WITH LIST / MAP TOGGLE            */}
        {/* ======================================================== */}
        <div className="flex lg:hidden flex-1 min-h-0 flex-col w-full pb-16">
          {mobileTab === 'list' ? (
            /* Mobile List View */
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isColdStarting && !isHealthDismissed && (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground flex items-center justify-between backdrop-blur-xs">
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4 shrink-0 text-primary animate-pulse" />
                    <span>☕ Kostenloser Server wacht auf (~30 Sek.)...</span>
                  </div>
                  <button
                    type="button"
                    onClick={dismissColdStart}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline shrink-0"
                  >
                    Ausblenden
                  </button>
                </div>
              )}

              <FilterBar
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                radiusKm={radiusKm}
                onRadiusChange={setRadiusKm}
                location={location}
                onLocationChange={setLocation}
                selectedLeagueId={selectedLeagueId}
                onLeagueChange={setSelectedLeagueId}
                onResetFilters={handleResetFilters}
                onRequestLocation={handleLocateUser}
                isLocating={isLocating}
                lastSyncedAt={lastSyncedAt}
              />

              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span>
                  <strong>{matches.length}</strong> Spiele im Umkreis ({radiusKm} km)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMobileTab('map')}
                  className="h-7 text-xs"
                >
                  <Compass className="mr-1 h-3 w-3 text-primary" />
                  Zur Karte
                </Button>
              </div>

              <MatchList
                matches={matches}
                selectedMatchId={selectedMatchId}
                onSelectMatch={(match) => {
                  setSelectedMatchId(match.id);
                  setMobileTab('map');
                }}
                isLoading={isLoading}
                radiusKm={radiusKm}
                onExpandRadius={handleExpandRadius}
                onResetFilters={handleResetFilters}
              />
            </div>
          ) : (
            /* Mobile Map View */
            <div className="relative flex-1 min-h-0 flex flex-col h-full">
              {/* Map Floating Summary Bar */}
              <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between rounded-lg border border-border/80 bg-background/90 px-3 py-1.5 shadow-md backdrop-blur-md text-xs">
                <div className="flex items-center gap-1.5 truncate">
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium truncate">{location.name}</span>
                  <span className="font-mono text-muted-foreground">
                    ({radiusKm} km)
                  </span>
                </div>

                <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                  {matches.length} Spiele
                </Badge>
              </div>

              <MapContainer
                matches={matches}
                selectedMatchId={selectedMatchId}
                center={mapCenter}
                zoom={9}
                userLocation={geoCoords ? [geoCoords.lat, geoCoords.lng] : null}
                onMarkerClick={handleMarkerClick}
                onLocateUser={handleLocateUser}
                isLocating={isLocating}
                className="h-full w-full flex-1 min-h-0 rounded-none border-0 shadow-none"
                mapHeightClassName="w-full h-full min-h-[400px]"
              />

              {/* Cold-Start Map Overlay (Mobile) */}
              <ColdStartOverlay
                isVisible={isColdStarting && !isHealthDismissed}
                onDismiss={dismissColdStart}
              />

              {/* Mobile Selected Match Card Preview at Bottom of Map */}
              {selectedMatch && (
                <div className="absolute bottom-2 left-2 right-2 z-20">
                  <MatchCard
                    match={selectedMatch}
                    isSelected
                    onClick={() => setMobileTab('list')}
                    className="shadow-xl bg-card/95 backdrop-blur-md"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation Bar (< 1024px) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/80 bg-background/95 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => setMobileTab('list')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-6 rounded-lg transition-colors ${
            mobileTab === 'list'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-base">📋</span>
          <span className="text-xs">
            Liste ({matches.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('map')}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-6 rounded-lg transition-colors ${
            mobileTab === 'map'
              ? 'text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="text-base">🗺️</span>
          <span className="text-xs">Karte</span>
        </button>
      </nav>

      {/* PWA Service Worker Update / Offline Prompt */}
      <ReloadPrompt />
    </div>
  );
}
