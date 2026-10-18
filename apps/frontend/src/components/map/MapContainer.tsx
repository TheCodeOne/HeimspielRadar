import * as React from 'react';
import { Compass, Layers, Loader2, LocateFixed } from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  LeafletEngine,
  MapLibreEngine,
  OpenLayersEngine,
  PigeonEngine,
} from './engines';
import type { MapEngineProps, MapEngineType } from './map-engine.types';

export interface MapContainerProps {
  matches: Match[];
  selectedMatchId?: number | null;
  center?: [number, number];
  zoom?: number;
  userLocation?: [number, number] | null;
  onMarkerClick: (match: Match) => void;
  onLocateUser?: () => void;
  isLocating?: boolean;
  className?: string;
  mapHeightClassName?: string;
  defaultEngine?: MapEngineType;
}

interface EngineOption {
  id: MapEngineType;
  label: string;
  badge: string;
  description: string;
}

const ENGINES: EngineOption[] = [
  {
    id: 'openlayers',
    label: 'OpenLayers',
    badge: 'GIS Pro',
    description: 'GIS-grade raster renderer mit OpenStreetMap-Tiles',
  },
  {
    id: 'maplibre',
    label: 'MapLibre GL',
    badge: 'Vector GL',
    description: 'OpenFreeMap Vector Tiles mit Hardwarebeschleunigung',
  },
  {
    id: 'leaflet',
    label: 'Leaflet',
    badge: 'Raster',
    description: 'Klassischer OSM Raster-Tile-Renderer mit React-Leaflet',
  },
  {
    id: 'pigeon',
    label: 'Pigeon Maps',
    badge: 'Pure React',
    description: 'Zero-Dependency Pure React Map-Renderer',
  },
];

function isMapEngineType(val: string): val is MapEngineType {
  return (
    val === 'maplibre' ||
    val === 'leaflet' ||
    val === 'pigeon' ||
    val === 'openlayers'
  );
}

export function MapContainer({
  matches,
  selectedMatchId,
  center = [49.15, 9.85],
  zoom = 9,
  userLocation,
  onMarkerClick,
  onLocateUser,
  isLocating = false,
  className = '',
  mapHeightClassName,
  defaultEngine = 'openlayers',
}: MapContainerProps) {
  const [engine, setEngine] = React.useState<MapEngineType>(defaultEngine);

  const activeOption =
    ENGINES.find((opt) => opt.id === engine) ?? ENGINES[0];

  const engineProps: MapEngineProps = {
    matches,
    selectedMatchId,
    center,
    zoom,
    userLocation,
    onMarkerClick,
    className: mapHeightClassName ?? 'w-full h-full min-h-[450px]',
  };

  const renderActiveEngine = () => {
    switch (engine) {
      case 'maplibre':
        return <MapLibreEngine key="maplibre" {...engineProps} />;

      case 'leaflet':
        return <LeafletEngine key="leaflet" {...engineProps} />;

      case 'pigeon':
        return <PigeonEngine key="pigeon" {...engineProps} />;

      case 'openlayers':
      default:
        return <OpenLayersEngine key="openlayers" {...engineProps} />;
    }
  };

  return (
    <Card className={`overflow-hidden border-border/80 ${className}`}>
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Multi-Spike Map Architecture
              </CardTitle>
              <Badge variant="outline" className="font-mono text-[10px]">
                {activeOption.badge}
              </Badge>
            </div>
            <CardDescription className="text-xs mt-0.5">
              {activeOption.description}
            </CardDescription>
          </div>

          <div className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-muted-foreground mr-1 hidden sm:inline-block" />
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted/60 p-1">
              {ENGINES.map((opt) => {
                const isActive = opt.id === engine;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (isMapEngineType(opt.id)) {
                        setEngine(opt.id);
                      }
                    }}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 min-h-0 relative">
        <div className="relative w-full h-full min-h-0">{renderActiveEngine()}</div>

        {onLocateUser && (
          <button
            type="button"
            onClick={onLocateUser}
            disabled={isLocating}
            className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 z-30 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background hover:text-primary active:scale-95 disabled:opacity-60 cursor-pointer"
            title="Auf meinen Standort zentrieren"
            aria-label="Auf meinen Standort zentrieren"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5 text-primary" />
            )}
            <span>Mein Standort</span>
          </button>
        )}
      </CardContent>
    </Card>
  );
}
