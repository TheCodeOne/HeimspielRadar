import * as React from 'react';
import type { Match } from '@sundayleague/shared-types';
import {
  clusterVenueGroups,
  createGeoJsonCircle,
  type GeoJsonCircleFeature,
  groupMatchesByVenue,
  type VenueCluster,
  type VenueGroup,
} from './map-utils';

export interface UseMapViewModelProps {
  matches: Match[];
  venueGroups?: VenueGroup[];
  selectedMatchId?: number | null;
  zoom?: number;
  searchLocation?: { lat: number; lng: number; name: string } | null;
  radiusKm?: number;
  showRadiusCircle?: boolean;
  teamQuery?: string;
}

export interface TeamBounds {
  bbox: [[number, number], [number, number]]; // [[minLng, minLat], [maxLng, maxLat]]
  isSingleVenue: boolean;
  singleCenter?: [number, number]; // [lng, lat]
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface RadiusGeoJsonCollection {
  type: 'FeatureCollection';
  features: GeoJsonCircleFeature[];
}

export interface MapViewModel {
  validVenues: Array<{ lat: number; lng: number }>;
  groups: VenueGroup[];
  clusters: VenueCluster[];
  currentZoom: number;
  setCurrentZoom: React.Dispatch<React.SetStateAction<number>>;
  onZoomChange: (newZoom: number) => void;
  radiusGeoJson: RadiusGeoJsonCollection;
  getRadiusCircleGeoJson: () => RadiusGeoJsonCollection;
  teamBounds: TeamBounds | null;
}

/**
 * Extracts and deduplicates valid venue coordinates from a match list.
 */
export function extractValidVenues(matches: Match[]): Array<{ lat: number; lng: number }> {
  const venuesList: Array<{ lat: number; lng: number }> = [];
  const seen = new Set<string>();

  for (const m of matches) {
    if (
      m.venue?.latitude != null &&
      m.venue?.longitude != null &&
      !isNaN(m.venue.latitude) &&
      !isNaN(m.venue.longitude)
    ) {
      const key = `${m.venue.latitude.toFixed(5)},${m.venue.longitude.toFixed(5)}`;

      if (!seen.has(key)) {
        seen.add(key);
        venuesList.push({ lat: m.venue.latitude, lng: m.venue.longitude });
      }
    }
  }

  return venuesList;
}

/**
 * Computes bounding box or single-venue focus coordinates for an active team query.
 */
export function computeTeamBounds(
  validVenues: Array<{ lat: number; lng: number }>,
  teamQuery?: string,
): TeamBounds | null {
  if (!teamQuery?.trim() || validVenues.length === 0) {
    return null;
  }

  if (validVenues.length === 1) {
    const single = validVenues[0];

    return {
      bbox: [
        [single.lng, single.lat],
        [single.lng, single.lat],
      ],
      isSingleVenue: true,
      singleCenter: [single.lng, single.lat],
      minLng: single.lng,
      minLat: single.lat,
      maxLng: single.lng,
      maxLat: single.lat,
    };
  }

  const minLng = Math.min(...validVenues.map((v) => v.lng));
  const maxLng = Math.max(...validVenues.map((v) => v.lng));
  const minLat = Math.min(...validVenues.map((v) => v.lat));
  const maxLat = Math.max(...validVenues.map((v) => v.lat));

  return {
    bbox: [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    isSingleVenue: false,
    minLng,
    minLat,
    maxLng,
    maxLat,
  };
}

/**
 * Generates a GeoJSON FeatureCollection for the search radius circle.
 */
export function createRadiusGeoJson(options: {
  searchLocation?: { lat: number; lng: number } | null;
  radiusKm?: number;
  showRadiusCircle?: boolean;
  teamQuery?: string;
}): RadiusGeoJsonCollection {
  const { searchLocation, radiusKm, showRadiusCircle = true, teamQuery } = options;

  if (
    !showRadiusCircle ||
    !searchLocation ||
    radiusKm == null ||
    radiusKm <= 0 ||
    Boolean(teamQuery?.trim())
  ) {
    return {
      type: 'FeatureCollection',
      features: [],
    };
  }

  const circleFeature = createGeoJsonCircle(
    [searchLocation.lng, searchLocation.lat],
    radiusKm,
  );

  return {
    type: 'FeatureCollection',
    features: [circleFeature],
  };
}

/**
 * Central View-Model Hook for interactive map presentation.
 * Encapsulates coordinate extraction, venue grouping, clustering,
 * radius circle GeoJSON generation, and bounding box computation.
 */
export function useMapViewModel({
  matches,
  venueGroups,
  selectedMatchId,
  zoom = 9,
  searchLocation,
  radiusKm,
  showRadiusCircle = true,
  teamQuery,
}: UseMapViewModelProps): MapViewModel {
  const [currentZoom, setCurrentZoom] = React.useState<number>(zoom);

  React.useEffect(() => {
    setCurrentZoom(zoom);
  }, [zoom]);

  const onZoomChange = React.useCallback((newZoom: number) => {
    setCurrentZoom(Math.round(newZoom));
  }, []);

  const validVenues = React.useMemo(() => extractValidVenues(matches), [matches]);

  const groups = React.useMemo(
    () => venueGroups ?? groupMatchesByVenue(matches, selectedMatchId),
    [venueGroups, matches, selectedMatchId],
  );

  const clusters = React.useMemo(
    () => clusterVenueGroups(groups, currentZoom),
    [groups, currentZoom],
  );

  const radiusGeoJson = React.useMemo(
    () =>
      createRadiusGeoJson({
        searchLocation,
        radiusKm,
        showRadiusCircle,
        teamQuery,
      }),
    [searchLocation, radiusKm, showRadiusCircle, teamQuery],
  );

  const getRadiusCircleGeoJson = React.useCallback(() => radiusGeoJson, [radiusGeoJson]);

  const teamBounds = React.useMemo(
    () => computeTeamBounds(validVenues, teamQuery),
    [validVenues, teamQuery],
  );

  return {
    validVenues,
    groups,
    clusters,
    currentZoom,
    setCurrentZoom,
    onZoomChange,
    radiusGeoJson,
    getRadiusCircleGeoJson,
    teamBounds,
  };
}
