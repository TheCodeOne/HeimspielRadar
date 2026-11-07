import type { League } from '@sundayleague/shared-types';
import { STUTTGART_FALLBACK } from './geo-utils';
import {
  createMatchFilters,
  FILTER_STORAGE_KEY,
  parseMatchFiltersUrlParams,
  type GeolocationPositionCoords,
  type MatchFiltersGeolocation,
  type MatchFiltersStorage,
  useMatchFilters,
} from './use-match-filters';

class MockStorage implements MatchFiltersStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const MOCK_LEAGUES: League[] = [
  {
    id: 101,
    dbbId: 101,
    name: 'Oberliga Herren',
    geschlecht: 'männlich',
    akName: 'Senioren',
    skName: 'Oberliga',
  },
  {
    id: 102,
    dbbId: 102,
    name: 'Landesliga Damen',
    geschlecht: 'weiblich',
    akName: 'Senioren',
    skName: 'Landesliga',
  },
  {
    id: 103,
    dbbId: 103,
    name: 'Jugend U18 männlich',
    geschlecht: 'männlich',
    akName: 'U18',
    skName: 'Bezirksliga',
  },
  {
    id: 104,
    dbbId: 104,
    name: 'Senioren Mixed Freizeit',
    geschlecht: 'mixed',
    akName: 'Senioren',
    skName: 'Freizeit',
  },
];

describe('useMatchFilters & MatchFiltersController (Headless Unit Tests)', () => {
  // Fixed reference date: Wednesday, Oct 21, 2026, 12:00 Berlin time
  const referenceDate = new Date('2026-10-21T10:00:00.000Z');
  const nowFn = () => referenceDate;

  describe('1. Preset Date Resolution', () => {
    it('resolves "today" date preset matching the reference date', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('today');
      const state = controller.getState();

      expect(state.dateMode).toBe('today');
      expect(state.dateFrom).toBe('2026-10-21');
      expect(state.dateTo).toBe('2026-10-21');
    });

    it('resolves "tomorrow" date preset', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('tomorrow');
      const state = controller.getState();

      expect(state.dateMode).toBe('tomorrow');
      expect(state.dateFrom).toBe('2026-10-22');
      expect(state.dateTo).toBe('2026-10-22');
    });

    it('resolves "weekend" to the upcoming Saturday & Sunday', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('weekend');
      const state = controller.getState();

      expect(state.dateMode).toBe('weekend');
      expect(state.dateFrom).toBe('2026-10-24');
      expect(state.dateTo).toBe('2026-10-25');
    });

    it('resolves "next-weekend" to Saturday & Sunday of the following week', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('next-weekend');
      const state = controller.getState();

      expect(state.dateMode).toBe('next-weekend');
      expect(state.dateFrom).toBe('2026-10-31');
      expect(state.dateTo).toBe('2026-11-01');
    });

    it('resolves "weekend-after-next" (+2 weeks)', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('weekend-after-next');
      const state = controller.getState();

      expect(state.dateMode).toBe('weekend-after-next');
      expect(state.dateFrom).toBe('2026-11-07');
      expect(state.dateTo).toBe('2026-11-08');
    });

    it('resolves "all" to empty date strings', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('all');
      const state = controller.getState();

      expect(state.dateMode).toBe('all');
      expect(state.dateFrom).toBe('');
      expect(state.dateTo).toBe('');
      expect(state.dateRangeDisplay).toBe('Alle Termine');
    });

    it('resolves custom date range via setDateRange', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateRange('2026-11-15', '2026-11-20');
      const state = controller.getState();

      expect(state.dateMode).toBe('custom');
      expect(state.dateFrom).toBe('2026-11-15');
      expect(state.dateTo).toBe('2026-11-20');
    });
  });

  describe('2. Expired Custom-Date Clamping', () => {
    it('clamps expired custom dates from storage to "today"', () => {
      const storage = new MockStorage();

      storage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          dateMode: 'custom',
          customDateFrom: '2020-01-01',
          customDateTo: '2020-01-05',
        }),
      );

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      const state = controller.getState();

      expect(state.dateMode).toBe('today');
      expect(state.dateFrom).toBe('2026-10-21');
      expect(state.dateTo).toBe('2026-10-21');
      expect(state.customDateFrom).toBe('');
      expect(state.customDateTo).toBe('');
    });

    it('clamps empty custom range from storage to "today"', () => {
      const storage = new MockStorage();

      storage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          dateMode: 'custom',
          customDateFrom: '',
          customDateTo: '',
        }),
      );

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      const state = controller.getState();

      expect(state.dateMode).toBe('today');
      expect(state.dateFrom).toBe('2026-10-21');
    });

    it('preserves valid future custom date range', () => {
      const storage = new MockStorage();

      storage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          dateMode: 'custom',
          customDateFrom: '2099-05-01',
          customDateTo: '2099-05-03',
        }),
      );

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      const state = controller.getState();

      expect(state.dateMode).toBe('custom');
      expect(state.dateFrom).toBe('2099-05-01');
      expect(state.dateTo).toBe('2099-05-03');
    });
  });

  describe('3. League Hierarchy Cascading', () => {
    it('prunes incompatible league IDs when gender filter is narrowed', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        leagues: MOCK_LEAGUES,
        now: nowFn,
      });

      // Select all 4 leagues: 101 (männlich), 102 (weiblich), 103 (männlich), 104 (mixed)
      controller.actions.setLeagueIds([101, 102, 103, 104]);
      expect(controller.getState().leagueIds).toEqual([101, 102, 103, 104]);

      // Narrow gender to 'männlich'
      controller.actions.setGenders(['männlich']);
      const state = controller.getState();

      expect(state.genders).toEqual(['männlich']);
      // 102 (weiblich) and 104 (mixed) must be pruned
      expect(state.leagueIds).toEqual([101, 103]);
    });

    it('prunes incompatible league IDs when ageClass filter is narrowed', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        leagues: MOCK_LEAGUES,
        now: nowFn,
      });

      controller.actions.setLeagueIds([101, 103]);
      controller.actions.setAgeClasses(['U18']);
      const state = controller.getState();

      expect(state.ageClasses).toEqual(['U18']);
      // 101 (Senioren) must be pruned, leaving 103 (U18)
      expect(state.leagueIds).toEqual([103]);
    });

    it('prunes incompatible league IDs when skillLevel filter is narrowed', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        leagues: MOCK_LEAGUES,
        now: nowFn,
      });

      controller.actions.setLeagueIds([101, 102]);
      controller.actions.setSkillLevels(['Landesliga']);
      const state = controller.getState();

      expect(state.skillLevels).toEqual(['Landesliga']);
      // 101 (Oberliga) must be pruned, leaving 102 (Landesliga)
      expect(state.leagueIds).toEqual([102]);
    });

    it('cascades leagueIds immediately when availableLeagues are provided dynamically', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setGenders(['weiblich']);
      controller.actions.setLeagueIds([101, 102, 103]);

      // At this point leagues are empty, so leagueIds stay [101, 102, 103]
      expect(controller.getState().leagueIds).toEqual([101, 102, 103]);

      // Dynamically load leagues
      controller.actions.setAvailableLeagues(MOCK_LEAGUES);

      // Now 101 and 103 are pruned because they are männlich, not weiblich
      expect(controller.getState().leagueIds).toEqual([102]);
    });

    it('filters leagues correctly based on hierarchy and search query', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        leagues: MOCK_LEAGUES,
        now: nowFn,
      });

      controller.actions.setGenders(['männlich']);
      const filtered = controller.getFilteredLeagues('U18');

      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe(103);
    });
  });

  describe('4. Storage Persistence & Sanitization', () => {
    it('persists changes to storage under the canonical key', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setRadius(45);
      controller.actions.setShowRadiusCircle(false);
      controller.actions.setOnlyUpcoming(false);

      const raw = storage.getItem(FILTER_STORAGE_KEY);
      expect(raw).not.toBeNull();

      if (raw) {
        // SAFETY: parsing JSON string from test mock
        const parsed = JSON.parse(raw);

        expect(parsed.radiusKm).toBe(45);
        expect(parsed.showRadiusCircle).toBe(false);
        expect(parsed.onlyUpcoming).toBe(false);
      }
    });

    it('clamps radius to [5, 50] range on storage load and user action', () => {
      const storage = new MockStorage();

      storage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({
          radiusKm: 120,
        }),
      );

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      // Default radius is 30 when corrupted out-of-range value is loaded
      expect(controller.getState().radiusKm).toBe(30);

      // Clamping via actions
      controller.actions.setRadius(2);
      expect(controller.getState().radiusKm).toBe(5);

      controller.actions.setRadius(85);
      expect(controller.getState().radiusKm).toBe(50);
    });

    it('gracefully sanitizes corrupted JSON in storage', () => {
      const storage = new MockStorage();
      storage.setItem(FILTER_STORAGE_KEY, '{ invalid JSON <<<');

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      const state = controller.getState();

      expect(state.radiusKm).toBe(30);
      expect(state.location.name).toBe(STUTTGART_FALLBACK.name);
      expect(state.viewMode).toBe('map');
    });

    it('resets filters while preserving current viewMode', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setViewMode('list');
      controller.actions.setRadius(40);
      controller.actions.setGenders(['männlich']);

      controller.actions.resetFilters();
      const state = controller.getState();

      expect(state.viewMode).toBe('list');
      expect(state.radiusKm).toBe(30);
      expect(state.genders).toEqual([]);
    });
  });

  describe('5. Geolocation Resolution Stand-in Seam', () => {
    it('resolves coordinates and updates location name to "Mein Standort" on success', async () => {
      const storage = new MockStorage();

      const mockGeoCoords: GeolocationPositionCoords = {
        lat: 48.7758,
        lng: 9.1829,
        accuracy: 10,
      };

      const mockGeolocation: MatchFiltersGeolocation = {
        requestLocation: async () => mockGeoCoords,
        getCurrentCoords: () => mockGeoCoords,
      };

      const controller = createMatchFilters({
        storage,
        geolocation: mockGeolocation,
        now: nowFn,
      });

      const resolvedLoc = await controller.actions.locateUser();

      expect(resolvedLoc).not.toBeNull();
      expect(resolvedLoc?.name).toBe('Mein Standort');
      expect(resolvedLoc?.lat).toBe(48.7758);
      expect(resolvedLoc?.lng).toBe(9.1829);

      const state = controller.getState();

      expect(state.location.name).toBe('Mein Standort');
      expect(state.isLocating).toBe(false);
      expect(state.locationError).toBeNull();
      expect(state.userCoords).toEqual(mockGeoCoords);
    });

    it('falls back to STUTTGART_FALLBACK when geolocation fails', async () => {
      const storage = new MockStorage();

      const mockGeolocation: MatchFiltersGeolocation = {
        requestLocation: async () => null,
      };

      const controller = createMatchFilters({
        storage,
        geolocation: mockGeolocation,
        now: nowFn,
      });

      const resolvedLoc = await controller.actions.locateUser();

      expect(resolvedLoc).toBeNull();
      const state = controller.getState();

      expect(state.location.name).toBe(STUTTGART_FALLBACK.name);
      expect(state.isLocating).toBe(false);
    });
  });

  describe('6. useMatchFilters Interface Without DOM Rendering', () => {
    it('executes headlessly through useMatchFilters({ headless: true })', () => {
      const storage = new MockStorage();

      const result = useMatchFilters({
        headless: true,
        storage,
        leagues: MOCK_LEAGUES,
        now: nowFn,
      });

      expect(result.filters).toBeDefined();
      expect(result.actions).toBeDefined();

      result.actions.setDateMode('tomorrow');
      const updated = result.controller.getState();

      expect(updated.dateMode).toBe('tomorrow');
      expect(updated.dateFrom).toBe('2026-10-22');
    });

    it('supports useMatchFilters.create(...) factory', () => {
      const storage = new MockStorage();

      const controller = useMatchFilters.create({
        storage,
        now: nowFn,
      });

      controller.actions.setRadius(25);
      expect(controller.getState().radiusKm).toBe(25);
    });
  });

  describe('7. Team & Club Search Filter (teamQuery)', () => {
    it('sets and clears teamQuery filter', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      expect(controller.getState().teamQuery).toBeUndefined();
      expect(controller.getState().activeFilterCount).toBe(0);

      controller.actions.setTeamQuery('SV Pfrondorf');
      expect(controller.getState().teamQuery).toBe('SV Pfrondorf');
      expect(controller.getState().activeFilterCount).toBe(1);

      controller.actions.setTeamQuery(undefined);
      expect(controller.getState().teamQuery).toBeUndefined();
      expect(controller.getState().activeFilterCount).toBe(0);
    });

    it('persists teamQuery to storage and restores correctly', () => {
      const storage = new MockStorage();

      const controller1 = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller1.actions.setTeamQuery('TSG Reutlingen');

      const controller2 = createMatchFilters({
        storage,
        now: nowFn,
      });

      expect(controller2.getState().teamQuery).toBe('TSG Reutlingen');
    });

    it('clears teamQuery on resetFilters', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setTeamQuery('SV 03 Tübingen');
      expect(controller.getState().teamQuery).toBe('SV 03 Tübingen');

      controller.actions.resetFilters();
      expect(controller.getState().teamQuery).toBeUndefined();
    });
  });

  describe('11. Query Seam Normalization (filterEngine.query)', () => {
    it('normalizes default filter state into a clean NearbyMatchesQuery without empty arrays', () => {
      const storage = new MockStorage();

      const filterEngine = useMatchFilters({
        storage,
        now: nowFn,
        headless: true,
      });

      const { query } = filterEngine;

      expect(query.lat).toBe(STUTTGART_FALLBACK.lat);
      expect(query.lng).toBe(STUTTGART_FALLBACK.lng);
      expect(query.radiusKm).toBe(30);
      expect(query.onlyUpcoming).toBe(true);
      // Weekend Oct 24-25, 2026: distinct range so date is undefined, dateFrom and dateTo are populated
      expect(query.dateFrom).toBe('2026-10-24');
      expect(query.dateTo).toBe('2026-10-25');
      expect(query.date).toBeUndefined();
      // Empty arrays and unset queries must be undefined
      expect(query.leagueIds).toBeUndefined();
      expect(query.genders).toBeUndefined();
      expect(query.gender).toBeUndefined();
      expect(query.ageClasses).toBeUndefined();
      expect(query.ageGroup).toBeUndefined();
      expect(query.skillLevels).toBeUndefined();
      expect(query.teamQuery).toBeUndefined();
      expect(query.teamSearch).toBeUndefined();
    });

    it('populates date, dateFrom, and dateTo identically when dateMode is a single day (today)', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setDateMode('today');
      const { query } = controller;

      expect(query.date).toBe('2026-10-21');
      expect(query.dateFrom).toBe('2026-10-21');
      expect(query.dateTo).toBe('2026-10-21');
    });

    it('normalizes complex hierarchical filters and singular aliases', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
        leagues: MOCK_LEAGUES,
      });

      controller.actions.setGenders(['männlich']);
      controller.actions.setAgeClasses(['Senioren']);
      controller.actions.setSkillLevels(['Oberliga']);
      controller.actions.setLeagueIds([101]);
      controller.actions.setTeamQuery('  TSG Reutlingen  ');
      controller.actions.setRadius(45);
      controller.actions.setOnlyUpcoming(false);

      const query = controller.getQuery();

      expect(query.radiusKm).toBe(45);
      expect(query.onlyUpcoming).toBe(false);
      expect(query.leagueIds).toEqual([101]);
      expect(query.genders).toEqual(['männlich']);
      expect(query.gender).toBe('männlich');
      expect(query.ageClasses).toEqual(['Senioren']);
      expect(query.ageGroup).toBe('Senioren');
      expect(query.skillLevels).toEqual(['Oberliga']);
      expect(query.teamQuery).toBe('TSG Reutlingen');
      expect(query.teamSearch).toBe('TSG Reutlingen');
    });

    it('resets query when resetFilters is invoked', () => {
      const storage = new MockStorage();

      const controller = createMatchFilters({
        storage,
        now: nowFn,
      });

      controller.actions.setTeamQuery('SV Pfrondorf');
      controller.actions.setRadius(50);
      expect(controller.query.teamQuery).toBe('SV Pfrondorf');
      expect(controller.query.radiusKm).toBe(50);

      controller.actions.resetFilters();
      expect(controller.query.teamQuery).toBeUndefined();
      expect(controller.query.radiusKm).toBe(30);
    });
  });

  describe('7. URL Query Parameter Evaluation on App Start', () => {
    describe('parseMatchFiltersUrlParams', () => {
      it('parses valid date preset query parameters and resets custom date', () => {
        expect(parseMatchFiltersUrlParams('?date=today')).toEqual({
          dateMode: 'today',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
        });

        expect(parseMatchFiltersUrlParams('?date=tomorrow')).toEqual({
          dateMode: 'tomorrow',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
        });

        expect(parseMatchFiltersUrlParams('?date=weekend')).toEqual({
          dateMode: 'weekend',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
        });

        expect(parseMatchFiltersUrlParams('?date=next-weekend')).toEqual({
          dateMode: 'next-weekend',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
        });

        expect(parseMatchFiltersUrlParams('?date=all')).toEqual({
          dateMode: 'all',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
        });
      });

      it('ignores unknown or unsupported date query parameter values', () => {
        expect(parseMatchFiltersUrlParams('?date=yesterday')).toEqual({});
        expect(parseMatchFiltersUrlParams('?date=some-random-date')).toEqual({});
      });

      it('parses valid view query parameters', () => {
        expect(parseMatchFiltersUrlParams('?view=list')).toEqual({
          viewMode: 'list',
        });

        expect(parseMatchFiltersUrlParams('?view=map')).toEqual({
          viewMode: 'map',
        });
      });

      it('ignores unknown view query parameters', () => {
        expect(parseMatchFiltersUrlParams('?view=grid')).toEqual({});
      });

      it('parses combined date and view query parameters', () => {
        expect(parseMatchFiltersUrlParams('?date=today&view=list')).toEqual({
          dateMode: 'today',
          customDate: null,
          customDateFrom: '',
          customDateTo: '',
          viewMode: 'list',
        });
      });
    });

    describe('createMatchFilters integration with searchParams', () => {
      it('overrides initial dateMode and viewMode on startup', () => {
        const storage = new MockStorage();

        const controller = createMatchFilters({
          storage,
          now: nowFn,
          searchParams: '?date=today&view=list',
        });

        const state = controller.getState();

        expect(state.dateMode).toBe('today');
        expect(state.viewMode).toBe('list');
        expect(state.customDate).toBeNull();
        expect(state.customDateFrom).toBe('');
        expect(state.customDateTo).toBe('');
        expect(state.dateFrom).toBe('2026-10-21');
        expect(state.dateTo).toBe('2026-10-21');
      });

      it('overrides persisted custom date range when valid date query param is present', () => {
        const storage = new MockStorage();

        // Simulate stored custom filter from previous session
        storage.setItem(
          FILTER_STORAGE_KEY,
          JSON.stringify({
            viewMode: 'map',
            dateMode: 'custom',
            customDateFrom: '2026-10-28',
            customDateTo: '2026-10-29',
            customDate: '2026-10-28',
          }),
        );

        const controller = createMatchFilters({
          storage,
          now: nowFn,
          searchParams: '?date=weekend',
        });

        const state = controller.getState();

        expect(state.dateMode).toBe('weekend');
        expect(state.customDate).toBeNull();
        expect(state.customDateFrom).toBe('');
        expect(state.customDateTo).toBe('');
        // Weekend for Wednesday 2026-10-21 is 2026-10-24 .. 2026-10-25
        expect(state.dateFrom).toBe('2026-10-24');
        expect(state.dateTo).toBe('2026-10-25');
      });
    });
  });
});
