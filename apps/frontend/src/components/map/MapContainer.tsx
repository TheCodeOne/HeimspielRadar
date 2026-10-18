import * as React from 'react';
import { Layers, Loader2, LocateFixed } from 'lucide-react';
import type { Match } from '@sundayleague/shared-types';
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

  const engineProps: MapEngineProps = {
    matches,
    selectedMatchId,
    center,
    zoom,
    userLocation,
    onMarkerClick,
    className: mapHeightClassName ?? 'w-full h-full',
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
    <div className={`relative flex-1 w-full h-full min-h-0 overflow-hidden ${className}`}>
      {/* Full-bleed map canvas occupying 100% width and height */}
      <div className="absolute inset-0 w-full h-full">{renderActiveEngine()}</div>

      {/* Floating Map Engine Selector (top-right / bottom-right non-intrusive pill) */}
      <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden sm:flex items-center gap-1 rounded-full border border-border/80 bg-background/90 p-1 shadow-lg backdrop-blur-md">
        <Layers className="ml-2 mr-1 h-3.5 w-3.5 text-muted-foreground" />
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
              className={`pointer-events-auto rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title={opt.description}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {onLocateUser && (
        <button
          type="button"
          onClick={onLocateUser}
          disabled={isLocating}
          className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/95 px-3 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background hover:text-primary active:scale-95 disabled:opacity-60 cursor-pointer"
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
    </div>
  );
}
