import type { Match } from '@sundayleague/shared-types';

export type MapEngineType = 'maplibre' | 'leaflet' | 'pigeon' | 'openlayers';

export interface MapEngineProps {
  matches: Match[];
  selectedMatchId?: number | null;
  center: [number, number]; // [lat, lng]
  zoom: number;
  userLocation?: [number, number] | null; // [lat, lng]
  searchLocation?: { lat: number; lng: number; name: string } | null;
  radiusKm?: number;
  showRadiusCircle?: boolean;
  onMarkerClick: (match: Match) => void;
  className?: string;
}
