import { renderToString } from 'react-dom/server';
import type { Match, Venue } from '@sundayleague/shared-types';
import {
  computeTeamBounds,
  createRadiusGeoJson,
  extractValidVenues,
  type MapViewModel,
  useMapViewModel,
} from './useMapViewModel';

describe('useMapViewModel', () => {
  const venueA: Venue = {
    id: 1,
    name: 'Sporthalle Nord',
    street: 'Nordstraße 1',
    postalCode: '70191',
    city: 'Stuttgart',
    latitude: 48.801,
    longitude: 9.182,
  };

  const venueB: Venue = {
    id: 2,
    name: 'Sporthalle Süd',
    street: 'Südstraße 2',
    postalCode: '70192',
    city: 'Stuttgart',
    latitude: 48.755,
    longitude: 9.165,
  };

  const venueDuplicateCoords: Venue = {
    id: 3,
    name: 'Sporthalle Nord Platz 2',
    street: 'Nordstraße 1',
    postalCode: '70191',
    city: 'Stuttgart',
    latitude: 48.801002, // rounds to 48.80100
    longitude: 9.182003,
  };

  const match1: Match = {
    id: 101,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-11-10',
    kickoffTime: '15:00',
    homeTeam: { id: 1, dbbId: 1, name: 'VfB Stuttgart' },
    guestTeam: { id: 2, dbbId: 2, name: 'Tigers Tübingen' },
    venue: venueA,
    result: null,
    confirmed: false,
  };

  const match2: Match = {
    id: 102,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-11-10',
    kickoffTime: '17:00',
    homeTeam: { id: 3, dbbId: 3, name: 'SV Möhringen' },
    guestTeam: { id: 4, dbbId: 4, name: 'TSG Reutlingen' },
    venue: venueB,
    result: null,
    confirmed: false,
  };

  const matchDuplicateVenue: Match = {
    id: 103,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-11-10',
    kickoffTime: '19:00',
    homeTeam: { id: 1, dbbId: 1, name: 'VfB Stuttgart 2' },
    guestTeam: { id: 5, dbbId: 5, name: 'Crailsheim Merlins' },
    venue: venueDuplicateCoords,
    result: null,
    confirmed: false,
  };

  describe('extractValidVenues', () => {
    it('extracts and deduplicates venues with valid coordinates', () => {
      const matches: Match[] = [match1, match2, matchDuplicateVenue];
      const result = extractValidVenues(matches);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { lat: 48.801, lng: 9.182 },
        { lat: 48.755, lng: 9.165 },
      ]);
    });

    it('ignores matches without venue or missing latitude/longitude', () => {
      const incompleteMatches: Match[] = [
        {
          ...match1,
          id: 201,
          venue: null,
        },
        {
          ...match1,
          id: 202,
          venue: {
            ...venueA,
            latitude: null,
          },
        },
        {
          ...match1,
          id: 203,
          venue: {
            ...venueA,
            longitude: Number.NaN,
          },
        },
      ];

      const result = extractValidVenues(incompleteMatches);
      expect(result).toEqual([]);
    });
  });

  describe('computeTeamBounds', () => {
    it('returns null when teamQuery is absent or whitespace', () => {
      const venues = [{ lat: 48.8, lng: 9.1 }];
      expect(computeTeamBounds(venues)).toBeNull();
      expect(computeTeamBounds(venues, '')).toBeNull();
      expect(computeTeamBounds(venues, '   ')).toBeNull();
    });

    it('returns null when validVenues is empty even with teamQuery', () => {
      expect(computeTeamBounds([], 'Tigers')).toBeNull();
    });

    it('returns single venue focus when validVenues has length 1', () => {
      const venues = [{ lat: 48.801, lng: 9.182 }];
      const result = computeTeamBounds(venues, 'VfB Stuttgart');

      expect(result).toEqual({
        bbox: [
          [9.182, 48.801],
          [9.182, 48.801],
        ],
        isSingleVenue: true,
        singleCenter: [9.182, 48.801],
        minLng: 9.182,
        minLat: 48.801,
        maxLng: 9.182,
        maxLat: 48.801,
      });
    });

    it('returns bounding box encompassing all venues when multiple venues exist', () => {
      const venues = [
        { lat: 48.801, lng: 9.182 },
        { lat: 48.755, lng: 9.165 },
      ];

      const result = computeTeamBounds(venues, 'Stuttgart');

      expect(result).toEqual({
        bbox: [
          [9.165, 48.755],
          [9.182, 48.801],
        ],
        isSingleVenue: false,
        minLng: 9.165,
        minLat: 48.755,
        maxLng: 9.182,
        maxLat: 48.801,
      });
    });
  });

  describe('createRadiusGeoJson', () => {
    it('returns empty FeatureCollection when showRadiusCircle is false', () => {
      const result = createRadiusGeoJson({
        searchLocation: { lat: 48.77, lng: 9.18 },
        radiusKm: 25,
        showRadiusCircle: false,
      });

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('returns empty FeatureCollection when searchLocation is missing or radius is non-positive', () => {
      expect(
        createRadiusGeoJson({ searchLocation: null, radiusKm: 25 }),
      ).toEqual({
        type: 'FeatureCollection',
        features: [],
      });

      expect(
        createRadiusGeoJson({
          searchLocation: { lat: 48.77, lng: 9.18 },
          radiusKm: 0,
        }),
      ).toEqual({
        type: 'FeatureCollection',
        features: [],
      });

      expect(
        createRadiusGeoJson({
          searchLocation: { lat: 48.77, lng: 9.18 },
          radiusKm: -10,
        }),
      ).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('returns empty FeatureCollection when teamQuery is active', () => {
      const result = createRadiusGeoJson({
        searchLocation: { lat: 48.77, lng: 9.18 },
        radiusKm: 25,
        teamQuery: 'Tigers',
      });

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [],
      });
    });

    it('generates a circular GeoJSON Polygon Feature when valid inputs are given', () => {
      const result = createRadiusGeoJson({
        searchLocation: { lat: 48.77, lng: 9.18 },
        radiusKm: 15,
        showRadiusCircle: true,
      });

      expect(result.type).toBe('FeatureCollection');
      expect(result.features).toHaveLength(1);
      const feature = result.features[0];
      expect(feature.type).toBe('Feature');
      expect(feature.geometry.type).toBe('Polygon');
      expect(feature.geometry.coordinates[0].length).toBeGreaterThan(10);
    });
  });

  describe('useMapViewModel hook', () => {
    function HookConsumer({
      props,
      onModel,
    }: {
      props: Parameters<typeof useMapViewModel>[0];
      onModel: (model: MapViewModel) => void;
    }) {
      const model = useMapViewModel(props);
      onModel(model);

      return null;
    }

    it('computes initial state correctly', () => {
      let capturedModel!: MapViewModel;

      renderToString(
        <HookConsumer
          props={{
            matches: [match1, match2],
            zoom: 11,
            searchLocation: { lat: 48.77, lng: 9.18, name: 'Stuttgart' },
            radiusKm: 20,
            showRadiusCircle: true,
          }}
          onModel={(m) => {
            capturedModel = m;
          }}
        />,
      );

      expect(capturedModel.currentZoom).toBe(11);
      expect(capturedModel.validVenues).toHaveLength(2);
      expect(capturedModel.groups).toHaveLength(2);
      expect(capturedModel.clusters.length).toBeGreaterThan(0);
      expect(capturedModel.radiusGeoJson.features).toHaveLength(1);
      expect(capturedModel.getRadiusCircleGeoJson()).toBe(capturedModel.radiusGeoJson);
      expect(capturedModel.teamBounds).toBeNull();
    });

    it('computes teamBounds when teamQuery is present', () => {
      let capturedModel!: MapViewModel;

      renderToString(
        <HookConsumer
          props={{
            matches: [match1],
            zoom: 10,
            teamQuery: 'VfB',
          }}
          onModel={(m) => {
            capturedModel = m;
          }}
        />,
      );

      expect(capturedModel.teamBounds).not.toBeNull();
      expect(capturedModel.teamBounds?.isSingleVenue).toBe(true);
      expect(capturedModel.teamBounds?.singleCenter).toEqual([9.182, 48.801]);
    });
  });
});
