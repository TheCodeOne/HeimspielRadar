import * as React from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  MapPin,
  Navigation,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Sample matches matching the domain model from GLOSSARY.md
const SAMPLE_MATCHES: Match[] = [
  {
    id: 101,
    leagueId: 1,
    matchDay: 14,
    kickoffDate: '2026-10-24',
    kickoffTime: '18:30',
    confirmed: true,
    distanceKm: 8.4,
    homeTeam: {
      id: 11,
      dbbId: 4011,
      name: 'TSG Schwäbisch Hall 1',
      shortName: 'SHA 1',
    },
    guestTeam: {
      id: 12,
      dbbId: 4012,
      name: 'SV Möhringen 2',
      shortName: 'SVM 2',
    },
    venue: {
      id: 201,
      name: 'Schenkbenseehalle',
      street: 'Schenkbenseestraße 40',
      postalCode: '74523',
      city: 'Schwäbisch Hall',
      latitude: 49.1122,
      longitude: 9.7354,
    },
  },
  {
    id: 102,
    leagueId: 1,
    matchDay: 14,
    kickoffDate: '2026-10-24',
    kickoffTime: '20:00',
    confirmed: true,
    distanceKm: 14.2,
    homeTeam: {
      id: 13,
      dbbId: 4013,
      name: 'Crailsheim Merlins 3',
      shortName: 'CRA 3',
    },
    guestTeam: {
      id: 14,
      dbbId: 4014,
      name: 'VfL Waiblingen 1',
      shortName: 'WAI 1',
    },
    venue: {
      id: 202,
      name: 'HAKRO Arena Crailsheim',
      street: 'In den Kistenwiesen 7',
      postalCode: '74564',
      city: 'Crailsheim',
      latitude: 49.1352,
      longitude: 10.0681,
    },
  },
  {
    id: 103,
    leagueId: 2,
    matchDay: 11,
    kickoffDate: '2026-10-25',
    kickoffTime: '15:00',
    confirmed: false,
    distanceKm: 28.6,
    homeTeam: {
      id: 15,
      dbbId: 4015,
      name: 'TSV Künzelsau',
      shortName: 'KÜN',
    },
    guestTeam: {
      id: 16,
      dbbId: 4016,
      name: 'Sportvg Feuerbach 2',
      shortName: 'FEU 2',
    },
    venue: {
      id: 203,
      name: 'Sporthalle Kocherraum',
      street: 'Wertwiesen 4',
      postalCode: '74653',
      city: 'Künzelsau',
      latitude: 49.2789,
      longitude: 9.6892,
    },
  },
];

export function App() {
  const [radiusKm, setRadiusKm] = React.useState<number>(30);
  const [selectedSpike, setSelectedSpike] = React.useState<string>('openlayers');

  const [selectedMatch, setSelectedMatch] = React.useState<Match>(
    SAMPLE_MATCHES[0],
  );

  const filteredMatches = SAMPLE_MATCHES.filter((m) => {
    return (m.distanceKm ?? 0) <= radiusKm;
  });

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card shadow-xs">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <div>
              <span className="font-semibold tracking-tight text-sm sm:text-base">
                HeimspielRadar
              </span>
              <span className="ml-2 hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
                Amateur-Basketball
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              Sa, 24. Okt
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <Navigation className="mr-1.5 h-3.5 w-3.5" />
              Stuttgart + {radiusKm}km
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Controls Section */}
        <div className="mb-6 rounded-xl border border-border/80 bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-tight">
                  Suchradius filtern
                </h2>
                <Badge variant="outline" className="ml-1 text-[11px] font-mono">
                  {radiusKm} km
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Heimspiele im Umkreis der gewählten Koordinaten (5 km bis 50 km)
              </p>
            </div>

            <div className="w-full md:w-72">
              <Slider
                value={[radiusKm]}
                min={5}
                max={50}
                step={5}
                onValueChange={(val) => {
                  const [nextRadius] = val;

                  if (nextRadius !== undefined) {
                    setRadiusKm(nextRadius);
                  }
                }}
              />
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground font-mono">
                <span>5 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Spike Switcher Tabs */}
        <Tabs
          value={selectedSpike}
          onValueChange={setSelectedSpike}
          className="w-full space-y-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Anstehende Heimspiele
              </h1>
              <p className="text-xs text-muted-foreground">
                {filteredMatches.length} Spiele gefunden im Umkreis von{' '}
                {radiusKm} km
              </p>
            </div>

            <TabsList className="self-start sm:self-auto">
              <TabsTrigger value="openlayers" className="text-xs">
                OpenLayers Spike
              </TabsTrigger>
              <TabsTrigger value="maplibre" className="text-xs">
                MapLibre Spike
              </TabsTrigger>
              <TabsTrigger value="list-only" className="text-xs">
                Listenansicht
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Unified Content Shell */}
          <TabsContent value="openlayers" className="m-0">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Match List Column */}
              <div className="space-y-4 lg:col-span-7">
                {filteredMatches.map((match) => {
                  const isSelected = selectedMatch.id === match.id;

                  return (
                    <Card
                      key={match.id}
                      onClick={() => setSelectedMatch(match)}
                      className={`cursor-pointer transition-all hover:border-primary/50 ${
                        isSelected
                          ? 'border-primary ring-1 ring-primary/30 shadow-md bg-card'
                          : 'border-border/70 hover:bg-muted/20'
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="league">
                              <Trophy className="mr-1 h-3 w-3" />
                              {match.leagueId === 1
                                ? 'Oberliga Württemberg'
                                : 'Landesliga'}
                            </Badge>
                            <Badge variant="kickoff">
                              <Clock className="mr-1 h-3 w-3" />
                              {match.kickoffTime} Uhr
                            </Badge>
                          </div>
                          {match.confirmed ? (
                            <Badge variant="success">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Bestätigt
                            </Badge>
                          ) : (
                            <Badge variant="warning">Vorläufig</Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="pb-3">
                        <div className="flex items-center justify-between gap-4 py-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Heimteam
                            </span>
                            <div className="font-semibold text-base">
                              {match.homeTeam.name}
                            </div>
                          </div>
                          <div className="text-xs font-mono font-medium text-muted-foreground px-2 py-1 rounded bg-muted">
                            VS
                          </div>
                          <div className="space-y-0.5 text-right">
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                              Gastteam
                            </span>
                            <div className="font-semibold text-base">
                              {match.guestTeam.name}
                            </div>
                          </div>
                        </div>

                        {match.venue && (
                          <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="truncate">
                                {match.venue.name}, {match.venue.city}
                              </span>
                            </div>
                            <span className="shrink-0 font-mono text-[11px] font-medium">
                              {match.distanceKm} km entfernt
                            </span>
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-0">
                        <div className="flex w-full items-center justify-between">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Spieltag {match.matchDay}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary"
                          >
                            Details & Navigation
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>

              {/* Map & Venue Preview Column */}
              <div className="space-y-4 lg:col-span-5">
                <Card className="sticky top-20 border-border/80">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Compass className="h-4 w-4 text-primary" />
                        Map Spike Preview
                      </CardTitle>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        OpenLayers
                      </Badge>
                    </div>
                    <CardDescription>
                      Aktiver Spike für Geolocation- und Distanztests
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Simulated Map Canvas */}
                    <div className="relative flex aspect-video w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-muted/30 p-4">
                      <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-40 dark:opacity-60" />

                      <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 border border-primary/30 text-primary mb-2 shadow-xs">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-semibold">
                          {selectedMatch.venue?.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {selectedMatch.venue?.street},{' '}
                          {selectedMatch.venue?.city}
                        </div>
                        <div className="mt-2 text-[10px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border border-border/40">
                          {selectedMatch.venue?.latitude?.toFixed(4)},{' '}
                          {selectedMatch.venue?.longitude?.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Venue Quick Card */}
                    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="text-xs font-semibold text-foreground">
                        Austragungsort (Sporthalle)
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>{selectedMatch.venue?.name}</div>
                        <div>
                          {selectedMatch.venue?.street},{' '}
                          {selectedMatch.venue?.postalCode}{' '}
                          {selectedMatch.venue?.city}
                        </div>
                        <div className="font-mono text-[11px] text-primary pt-1">
                          Luftlinie: {selectedMatch.distanceKm} km
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="flex gap-2">
                    <Button variant="default" size="sm" className="w-full text-xs">
                      <Navigation className="mr-1.5 h-3.5 w-3.5" />
                      Routenplaner öffnen
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs">
                      Spike wechseln
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="maplibre" className="m-0">
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <Compass className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="text-sm font-semibold">MapLibre Vector Spike</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Die MapLibre GL Spike-Implementierung wird im Rahmen von Spike #3
                evaluiert.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
                onClick={() => setSelectedSpike('openlayers')}
              >
                Zurück zu OpenLayers
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="list-only" className="m-0">
            <div className="space-y-4">
              {filteredMatches.map((match) => (
                <Card key={match.id} className="border-border/70">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="league">
                          {match.leagueId === 1
                            ? 'Oberliga Württemberg'
                            : 'Landesliga'}
                        </Badge>
                        <span className="font-semibold text-sm">
                          {match.homeTeam.name} vs. {match.guestTeam.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="kickoff">
                          {match.kickoffDate} {match.kickoffTime}
                        </Badge>
                        <span className="font-mono text-xs text-muted-foreground">
                          {match.distanceKm} km
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
