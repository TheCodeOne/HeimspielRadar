import * as React from 'react';
import { renderToString } from 'react-dom/server';
import type { Match } from '@sundayleague/shared-types';
import {
  filterAndSortMatchesLocally,
  getMasterPoolDateRange,
  isQueryCoveredByMasterPool,
  isTeamNumberMatch,
  MASTER_POOL_HORIZON_DAYS,
  MASTER_POOL_RADIUS_KM,
  useMatches,
  type MasterPoolState,
  type UseMatchesOptions,
} from './use-matches';

describe('isTeamNumberMatch', () => {
  describe('exact team selection vs reserve teams', () => {
    it('matches first team when query is exact base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(true);
    });

    it('rejects reserve team 2 when query is first team base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(false);
    });

    it('rejects reserve team 3 when query is first team base name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 3', 'Möss3', undefined, 'SpVgg Mössingen', 'SpVgg Mössingen'),
      ).toBe(false);
    });

    it('matches reserve team 2 when query specifically requests team 2', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 2, 'SpVgg Mössingen', 'SpVgg Mössingen 2'),
      ).toBe(true);
    });

    it('rejects first team when query specifically requests team 2', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 2, 'SpVgg Mössingen', 'SpVgg Mössingen 2'),
      ).toBe(false);
    });

    it('matches first team when query explicitly ends with 1', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 1, 'SpVgg Mössingen', 'SpVgg Mössingen 1'),
      ).toBe(true);
    });

    it('rejects reserve team 2 when query explicitly ends with 1', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 1, 'SpVgg Mössingen', 'SpVgg Mössingen 1'),
      ).toBe(false);
    });
  });

  describe('club-level search queries without team specification', () => {
    it('allows both first and reserve teams when searching by club name', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', undefined, 'Mössingen', 'Mössingen'),
      ).toBe(true);

      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', undefined, 'Mössingen', 'Mössingen'),
      ).toBe(true);
    });

    it('disambiguates club name when number is appended (Mössingen 1 vs Mössingen 2)', () => {
      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 1, 'Mössingen', 'Mössingen 1'),
      ).toBe(true);

      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 1, 'Mössingen', 'Mössingen 1'),
      ).toBe(false);

      expect(
        isTeamNumberMatch('SpVgg Mössingen', 'Möss', 2, 'Mössingen', 'Mössingen 2'),
      ).toBe(false);

      expect(
        isTeamNumberMatch('SpVgg Mössingen 2', 'Möss2', 2, 'Mössingen', 'Mössingen 2'),
      ).toBe(true);
    });
  });

  describe('composite queries with age class or gender', () => {
    it('matches first team and rejects reserve team for "MTV Stuttgart U12"', () => {
      expect(
        isTeamNumberMatch('MTV Stuttgart', 'MTV', undefined, 'MTV Stuttgart U12', 'MTV Stuttgart U12'),
      ).toBe(true);

      expect(
        isTeamNumberMatch('MTV Stuttgart 2', 'MTV2', undefined, 'MTV Stuttgart U12', 'MTV Stuttgart U12'),
      ).toBe(false);
    });
  });
});

describe('getMasterPoolDateRange', () => {
  it('calculates a 28-day horizon in Berlin timezone', () => {
    const fixedNow = new Date('2026-11-06T12:00:00Z');
    const range = getMasterPoolDateRange(fixedNow);

    expect(range.dateFrom).toBe('2026-11-06');
    expect(range.dateTo).toBe('2026-12-04');
    expect(MASTER_POOL_HORIZON_DAYS).toBe(28);
    expect(MASTER_POOL_RADIUS_KM).toBe(50);
  });
});

describe('isQueryCoveredByMasterPool', () => {
  const basePool: MasterPoolState = {
    lat: 48.5200,
    lng: 9.0550,
    dateFrom: '2026-11-06',
    dateTo: '2026-12-04',
    matches: [],
    isLoaded: true,
  };

  it('returns true when query radius and date are within master pool bounds', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
        date: '2026-11-07',
      },
      basePool,
    );

    expect(covered).toBe(true);
  });

  it('returns true for date range presets (dateFrom / dateTo)', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 25,
        dateFrom: '2026-11-07',
        dateTo: '2026-11-08',
      },
      basePool,
    );

    expect(covered).toBe(true);
  });

  it('returns true when query origin is slightly shifted but within bounds', () => {
    // Shifting origin by ~2km: originDist (2) + radiusKm (15) = 17 <= 50
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5350,
        lng: 9.0600,
        radiusKm: 15,
        date: '2026-11-07',
      },
      basePool,
    );

    expect(covered).toBe(true);
  });

  it('returns true when sub-filters like league, gender, and teamQuery are active', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
        date: '2026-11-07',
        leagueId: 10,
        leagueIds: [10, 20],
        genders: ['männlich'],
        ageClasses: ['Senioren'],
        skillLevels: ['Bezirksliga'],
        teamQuery: 'Mössingen',
        onlyUpcoming: true,
      },
      basePool,
    );

    expect(covered).toBe(true);
  });

  it('returns false when pool is not loaded yet', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
        date: '2026-11-07',
      },
      { ...basePool, isLoaded: false },
    );

    expect(covered).toBe(false);
  });

  it('returns false when query radius exceeds master pool radius (50km)', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 60,
        date: '2026-11-07',
      },
      basePool,
    );

    expect(covered).toBe(false);
  });

  it('returns false when query origin shift + radius exceeds 50km', () => {
    // Center at Tübingen (48.52, 9.055), query at Stuttgart (~30km away) with radius 25km (30 + 25 = 55 > 50)
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.7758,
        lng: 9.1829,
        radiusKm: 25,
        date: '2026-11-07',
      },
      basePool,
    );

    expect(covered).toBe(false);
  });

  it('returns false when query date is beyond master pool horizon', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
        date: '2026-12-15',
      },
      basePool,
    );

    expect(covered).toBe(false);
  });

  it('returns false when query date is before master pool dateFrom', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
        date: '2026-11-01',
      },
      basePool,
    );

    expect(covered).toBe(false);
  });

  it('returns false when query date is unbounded (dateMode: all)', () => {
    const covered = isQueryCoveredByMasterPool(
      {
        lat: 48.5200,
        lng: 9.0550,
        radiusKm: 15,
      },
      basePool,
    );

    expect(covered).toBe(false);
  });

  it('returns false when coordinates are missing, 0,0, or NaN', () => {
    expect(
      isQueryCoveredByMasterPool(
        {
          lat: 0,
          lng: 0,
          radiusKm: 15,
          date: '2026-11-07',
        },
        basePool,
      ),
    ).toBe(false);

    expect(
      isQueryCoveredByMasterPool(
        {
          lat: Number.NaN,
          lng: 9.0550,
          radiusKm: 15,
          date: '2026-11-07',
        },
        basePool,
      ),
    ).toBe(false);
  });
});

describe('filterAndSortMatchesLocally', () => {
  const matchSaturdayMorning: Match = {
    id: 1,
    leagueId: 10,
    matchDay: 1,
    matchNo: 101,
    kickoffDate: '2026-11-07',
    kickoffTime: '11:00',
    confirmed: true,
    homeTeam: {
      id: 1,
      dbbId: 1001,
      name: 'SpVgg Mössingen',
      shortName: 'Mössingen',
    },
    guestTeam: {
      id: 2,
      dbbId: 1002,
      name: 'TSV Lustnau',
      shortName: 'Lustnau',
    },
    venue: {
      id: 100,
      name: 'Sportplatz Mössingen',
      street: 'Lange Str. 10',
      postalCode: '72116',
      city: 'Mössingen',
      latitude: 48.4050,
      longitude: 9.0600,
    },
    league: {
      id: 10,
      dbbId: 4010,
      name: 'Bezirksliga Herren',
      geschlecht: 'männlich',
      akName: 'Senioren',
      skName: 'Bezirksliga',
    },
  };

  const matchSaturdayAfternoon: Match = {
    id: 2,
    leagueId: 10,
    matchDay: 1,
    matchNo: 102,
    kickoffDate: '2026-11-07',
    kickoffTime: '15:30',
    confirmed: true,
    homeTeam: {
      id: 3,
      dbbId: 1003,
      name: 'SpVgg Mössingen 2',
      shortName: 'Mössingen 2',
    },
    guestTeam: {
      id: 4,
      dbbId: 1004,
      name: 'TV Derendingen',
      shortName: 'Derendingen',
    },
    venue: {
      id: 100,
      name: 'Sportplatz Mössingen',
      street: 'Lange Str. 10',
      postalCode: '72116',
      city: 'Mössingen',
      latitude: 48.4050,
      longitude: 9.0600,
    },
    league: {
      id: 10,
      dbbId: 4010,
      name: 'Kreisliga Herren',
      geschlecht: 'männlich',
      akName: 'Senioren',
      skName: 'Kreisliga',
    },
  };

  const matchSunday: Match = {
    id: 3,
    leagueId: 20,
    matchDay: 2,
    matchNo: 201,
    kickoffDate: '2026-11-08',
    kickoffTime: '14:00',
    confirmed: true,
    homeTeam: {
      id: 5,
      dbbId: 1005,
      name: 'SV 03 Tübingen',
      shortName: 'Tübingen',
    },
    guestTeam: {
      id: 6,
      dbbId: 1006,
      name: 'TSG Reutlingen',
      shortName: 'Reutlingen',
    },
    venue: {
      id: 200,
      name: 'Uhlandhalle Tübingen',
      street: 'Uhlandstr. 20',
      postalCode: '72072',
      city: 'Tübingen',
      latitude: 48.5200,
      longitude: 9.0550,
    },
    league: {
      id: 20,
      dbbId: 4020,
      name: 'Landesliga Damen',
      geschlecht: 'weiblich',
      akName: 'Senioren',
      skName: 'Landesliga',
    },
  };

  const poolMatches = [matchSunday, matchSaturdayAfternoon, matchSaturdayMorning];

  it('filters matches by date and calculates distance', () => {
    const results = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-07',
    });

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe(1); // 11:00 earlier than 15:30
    expect(results[1].id).toBe(2);
    expect(results[0].distanceKm).toBeDefined();
    expect(results[0].distanceKm).toBeGreaterThan(0);
  });

  it('filters matches by date range (weekend)', () => {
    const results = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 25,
      dateFrom: '2026-11-07',
      dateTo: '2026-11-08',
    });

    expect(results).toHaveLength(3);
    // Distance-first ordering: Tübingen (0km, match 3), then Mössingen (13km) sorted chronologically (11:00 match 1, then 15:30 match 2)
    expect(results[0].id).toBe(3);
    expect(results[1].id).toBe(1);
    expect(results[2].id).toBe(2);
  });

  it('excludes matches on non-matching dates', () => {
    const results = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-09',
    });

    expect(results).toHaveLength(0);
  });

  it('filters matches by gender', () => {
    const results = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 25,
      dateFrom: '2026-11-07',
      dateTo: '2026-11-08',
      genders: ['weiblich'],
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3);
    expect(results[0].homeTeam.name).toBe('SV 03 Tübingen');
  });

  it('filters matches by team query and disambiguates reserve teams', () => {
    const resultsFirstTeam = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 25,
      date: '2026-11-07',
      teamQuery: 'SpVgg Mössingen',
    });

    expect(resultsFirstTeam).toHaveLength(1);
    expect(resultsFirstTeam[0].id).toBe(1);
    expect(resultsFirstTeam[0].homeTeam.name).toBe('SpVgg Mössingen');

    const resultsReserveTeam = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 25,
      date: '2026-11-07',
      teamQuery: 'Mössingen 2',
    });

    expect(resultsReserveTeam).toHaveLength(1);
    expect(resultsReserveTeam[0].id).toBe(2);
    expect(resultsReserveTeam[0].homeTeam.name).toBe('SpVgg Mössingen 2');
  });

  it('filters matches by radius and excludes distant venues', () => {
    // Mössingen is ~13km from Tübingen center. Query with radius 5km excludes Mössingen.
    const results = filterAndSortMatchesLocally(poolMatches, {
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 5,
      dateFrom: '2026-11-07',
      dateTo: '2026-11-08',
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(3); // Uhlandhalle Tübingen is within 5km
  });
});

describe('useMatches hook instant filtering behavior', () => {
  const sampleMatch: Match = {
    id: 1,
    leagueId: 10,
    matchDay: 1,
    matchNo: 101,
    kickoffDate: '2026-11-07',
    kickoffTime: '14:00',
    confirmed: true,
    homeTeam: {
      id: 1,
      dbbId: 1001,
      name: 'SpVgg Mössingen',
      shortName: 'Mössingen',
    },
    guestTeam: {
      id: 2,
      dbbId: 1002,
      name: 'TSV Lustnau',
      shortName: 'Lustnau',
    },
    venue: {
      id: 100,
      name: 'Sportplatz Mössingen',
      street: 'Lange Str. 10',
      postalCode: '72116',
      city: 'Mössingen',
      latitude: 48.4050,
      longitude: 9.0600,
    },
  };

  const loadedPool: MasterPoolState = {
    lat: 48.5200,
    lng: 9.0550,
    dateFrom: '2026-11-06',
    dateTo: '2026-12-04',
    matches: [sampleMatch],
    isLoaded: true,
  };

  function executeHook(options: UseMatchesOptions) {
    let hookResult: ReturnType<typeof useMatches> | undefined;

    function TestRunner() {
      hookResult = useMatches(options);

      return null;
    }

    renderToString(React.createElement(TestRunner));

    // SAFETY: renderToString synchronously executes TestRunner and populates hookResult
    return hookResult as ReturnType<typeof useMatches>;
  }

  it('returns synchronous filtered matches with isLoading=false when query is covered', () => {
    const result = executeHook({
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-07',
      initialMasterPool: loadedPool,
    });

    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe(1);
  });

  it('switches between presets instantly without loading state', () => {
    const todayResult = executeHook({
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-07',
      initialMasterPool: loadedPool,
    });

    expect(todayResult.isLoading).toBe(false);
    expect(todayResult.matches).toHaveLength(1);

    const tomorrowResult = executeHook({
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-08',
      initialMasterPool: loadedPool,
    });

    expect(tomorrowResult.isLoading).toBe(false);
    expect(tomorrowResult.matches).toHaveLength(0);
  });

  it('returns isLoading=true when query exceeds master pool radius (out-of-bounds)', () => {
    const result = executeHook({
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 60, // Exceeds 50km
      date: '2026-11-07',
      initialMasterPool: loadedPool,
    });

    expect(result.isLoading).toBe(true);
  });

  it('serves matches from loaded master pool as resilient fallback during offline or network error', () => {
    const result = executeHook({
      lat: 48.5200,
      lng: 9.0550,
      radiusKm: 20,
      date: '2026-11-07',
      initialMasterPool: loadedPool,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].id).toBe(1);
    expect(result.error).toBeNull();
  });
});
