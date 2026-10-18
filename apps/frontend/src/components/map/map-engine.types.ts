import type { Match } from '@sundayleague/shared-types';

export type MapEngineType = 'maplibre' | 'leaflet' | 'pigeon' | 'openlayers';

export interface MapEngineProps {
  matches: Match[];
  selectedMatchId?: number | null;
  center: [number, number]; // [lat, lng]
  zoom: number;
  onMarkerClick: (match: Match) => void;
  className?: string;
}
