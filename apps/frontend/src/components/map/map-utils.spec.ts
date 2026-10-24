import type { Match, Venue } from '@sundayleague/shared-types';
import {
  clusterVenueGroups,
  createClusterMarkerElement,
  createSearchCenterMarkerElement,
  createUserLocationMarkerElement,
  createVenueMarkerElement,
  getBasketballPinHtml,
  getBasketballPinSvg,
  getClusterBadgeHtml,
  getSearchCenterPinHtml,
  getUserLocationPinHtml,
  groupMatchesByVenue,
  isSameVenue,
  type VenueGroup,
} from './map-utils';

describe('map-utils', () => {
  const venueA: Venue = {
    id: 101,
    name: 'Sporthalle West',
    street: 'Bebelstraße 24',
    postalCode: '70193',
    city: 'Stuttgart',
    latitude: 48.7745,
    longitude: 9.1565,
  };

  const venueSameCoordsDifferentId: Venue = {
    id: 999,
    name: 'Sporthalle West Halle 2',
    street: 'Bebelstraße 24',
    postalCode: '70193',
    city: 'Stuttgart',
    latitude: 48.7745,
    longitude: 9.1565,
  };

  const venueB: Venue = {
    id: 102,
    name: 'Paul Horn-Arena',
    street: 'Europastraße 50',
    postalCode: '72072',
    city: 'Tübingen',
    latitude: 48.5135,
    longitude: 9.0435,
  };

  const match1: Match = {
    id: 1,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-10-25',
    kickoffTime: '18:00',
    homeTeam: { id: 1, dbbId: 1, name: 'Team A' },
    guestTeam: { id: 2, dbbId: 2, name: 'Team B' },
    venue: venueA,
    result: null,
    confirmed: false,
  };

  const match2Later: Match = {
    id: 2,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-10-25',
    kickoffTime: '20:00',
    homeTeam: { id: 3, dbbId: 3, name: 'Team C' },
    guestTeam: { id: 4, dbbId: 4, name: 'Team D' },
    venue: venueA,
    result: null,
    confirmed: false,
  };

  const matchSameVenueDiffId: Match = {
    id: 3,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-10-25',
    kickoffTime: '16:00',
    homeTeam: { id: 5, dbbId: 5, name: 'Team E' },
    guestTeam: { id: 6, dbbId: 6, name: 'Team F' },
    venue: venueSameCoordsDifferentId,
    result: null,
    confirmed: false,
  };

  const matchOtherVenue: Match = {
    id: 4,
    leagueId: 1,
    matchDay: 1,
    kickoffDate: '2026-10-25',
    kickoffTime: '17:30',
    homeTeam: { id: 7, dbbId: 7, name: 'Team G' },
    guestTeam: { id: 8, dbbId: 8, name: 'Team H' },
    venue: venueB,
    result: null,
    confirmed: false,
  };

  describe('isSameVenue', () => {
    it('returns false when either argument is null or undefined', () => {
      expect(isSameVenue(null, venueA)).toBe(false);
      expect(isSameVenue(venueA, undefined)).toBe(false);
      expect(isSameVenue(null, null)).toBe(false);
    });

    it('returns false when match venue is null', () => {
      const matchNoVenue = { ...match1, venue: null };

      expect(isSameVenue(matchNoVenue, match1)).toBe(false);
    });

    it('returns true when venue ids match', () => {
      const venueWithDiffCoords = { ...venueA, latitude: 12.34, longitude: 56.78 };

      expect(isSameVenue(venueA, venueWithDiffCoords)).toBe(true);
      expect(isSameVenue(match1, { ...match2Later, venue: venueWithDiffCoords })).toBe(true);
    });

    it('returns true when coordinates match even if venue ids differ', () => {
      expect(isSameVenue(venueA, venueSameCoordsDifferentId)).toBe(true);
      expect(isSameVenue(match1, matchSameVenueDiffId)).toBe(true);
    });

    it('returns false when both venue ids and coordinates differ', () => {
      expect(isSameVenue(venueA, venueB)).toBe(false);
      expect(isSameVenue(match1, matchOtherVenue)).toBe(false);
    });
  });

  describe('groupMatchesByVenue', () => {
    it('returns empty array when matches array is empty', () => {
      expect(groupMatchesByVenue([])).toEqual([]);
    });

    it('skips matches missing a venue or coordinates', () => {
      const invalidMatches: Match[] = [
        { ...match1, venue: null },
        { ...match1, venue: { ...venueA, latitude: null } },
        { ...match1, venue: { ...venueA, longitude: null } },
      ];

      expect(groupMatchesByVenue(invalidMatches)).toEqual([]);
    });

    it('groups matches with same coordinates into one venue group', () => {
      const matches = [match2Later, matchSameVenueDiffId, match1];
      const groups = groupMatchesByVenue(matches);

      expect(groups).toHaveLength(1);
      expect(groups[0].matches).toHaveLength(3);
      // Chronologically sorted: 16:00 (id: 3), 18:00 (id: 1), 20:00 (id: 2)
      expect(groups[0].matches.map((m) => m.id)).toEqual([3, 1, 2]);
    });

    it('marks isSelected correctly when selectedMatchId is provided', () => {
      const matches = [match1, matchOtherVenue];
      const groups = groupMatchesByVenue(matches, matchOtherVenue.id);

      expect(groups).toHaveLength(2);
      const groupA = groups.find((g) => g.venueId === venueA.id);
      const groupB = groups.find((g) => g.venueId === venueB.id);

      expect(groupA?.isSelected).toBe(false);
      expect(groupB?.isSelected).toBe(true);
    });
  });

  describe('clusterVenueGroups', () => {
    it('returns individual clusters when zoom >= 15', () => {
      const groups = groupMatchesByVenue([match1, matchOtherVenue]);
      const clusters = clusterVenueGroups(groups, 15);

      expect(clusters).toHaveLength(2);
      expect(clusters[0].isCluster).toBe(false);
      expect(clusters[1].isCluster).toBe(false);
    });

    it('clusters nearby venues when zoomed out', () => {
      const nearbyVenue: Venue = {
        id: 103,
        name: 'Sporthalle Ost',
        street: 'Oststraße 1',
        postalCode: '70193',
        city: 'Stuttgart',
        latitude: 48.775,
        longitude: 9.157,
      };

      const nearbyMatch: Match = {
        ...match1,
        id: 99,
        venue: nearbyVenue,
      };

      const groups = groupMatchesByVenue([match1, nearbyMatch], 99);
      const clusters = clusterVenueGroups(groups, 9);

      expect(clusters).toHaveLength(1);
      expect(clusters[0].isCluster).toBe(true);
      expect(clusters[0].matchCount).toBe(2);
      expect(clusters[0].isSelected).toBe(true);
    });
  });

  describe('SVG, HTML & DOM factories', () => {
    it('getBasketballPinSvg renders blue fill when selected and dark fill when unselected', () => {
      const selectedSvg = getBasketballPinSvg(true);
      const unselectedSvg = getBasketballPinSvg(false);

      expect(selectedSvg).toContain('#2563eb');
      expect(unselectedSvg).toContain('#0f172a');
      expect(selectedSvg).toContain('circle cx="18" cy="18" r="9.5" fill="#f97316"');
    });

    it('getBasketballPinHtml renders match badge only when matchCount > 1', () => {
      const singleMatch = getBasketballPinHtml(false, 1);
      const multiMatch = getBasketballPinHtml(true, 3);

      expect(singleMatch).not.toContain('>1</span>');
      expect(multiMatch).toContain('>3</span>');
      expect(multiMatch).toContain('scale(1.2)');
    });

    it('getClusterBadgeHtml formats plural correctly', () => {
      const singleCluster = getClusterBadgeHtml(1, false);
      const multiCluster = getClusterBadgeHtml(4, true);

      expect(singleCluster).toContain('Spiel');
      expect(singleCluster).not.toContain('Spiele');
      expect(multiCluster).toContain('Spiele');
      expect(multiCluster).toContain('border:3px solid #2563eb');
    });

    it('getSearchCenterPinHtml includes city name and pin SVG', () => {
      const html = getSearchCenterPinHtml('Stuttgart');

      expect(html).toContain('search-center-marker');
      expect(html).toContain('Stuttgart');
      expect(html).toContain('🎯');
    });

    it('getUserLocationPinHtml includes ping and dot', () => {
      const html = getUserLocationPinHtml();

      expect(html).toContain('user-location-ping');
      expect(html).toContain('#3b82f6');
    });

    describe('DOM element creation', () => {
      beforeAll(() => {
        interface FakeElement {
          className: string;
          style: { zIndex: string };
          innerHTML: string;
        }

        const fakeDoc = {
          createElement(_tag: string): FakeElement {
            return {
              className: '',
              style: { zIndex: '' },
              innerHTML: '',
            };
          },
        };

        Object.defineProperty(globalThis, 'document', {
          value: fakeDoc,
          configurable: true,
          writable: true,
        });
      });

      it('createVenueMarkerElement creates element with expected classes and z-index', () => {
        const group: VenueGroup = {
          venueId: 101,
          venue: venueA,
          matches: [match1, match2Later],
          isSelected: true,
        };

        const el = createVenueMarkerElement(group);

        expect(el.className).toContain('cursor-pointer');
        expect(el.style.zIndex).toBe('30');
        expect(el.innerHTML).toContain('2</span>');
      });

      it('createClusterMarkerElement creates element with expected z-index', () => {
        const el = createClusterMarkerElement({ matchCount: 5, isSelected: false });

        expect(el.className).toContain('cursor-pointer');
        expect(el.style.zIndex).toBe('20');
        expect(el.innerHTML).toContain('5</span>');
      });

      it('createSearchCenterMarkerElement creates element with search-center-marker class', () => {
        const el = createSearchCenterMarkerElement('Tübingen');

        expect(el.className).toContain('search-center-marker');
        expect(el.innerHTML).toContain('Tübingen');
      });

      it('createUserLocationMarkerElement creates element with user-location-marker class', () => {
        const el = createUserLocationMarkerElement();

        expect(el.className).toContain('user-location-marker');
        expect(el.innerHTML).toContain('user-location-ping');
      });
    });
  });
});
