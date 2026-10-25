import type { Match } from '@sundayleague/shared-types';
import { getMatchLinks } from './match-links';

describe('getMatchLinks', () => {
  const baseMatch: Match = {
    id: 98765,
    leagueId: 44101,
    league: {
      id: 12,
      dbbId: 54321,
      name: 'Oberliga Württemberg',
    },
    matchDay: 3,
    kickoffDate: '2026-11-15',
    kickoffTime: '17:30',
    homeTeam: { id: 1, dbbId: 101, name: 'TSV Crailsheim' },
    guestTeam: { id: 2, dbbId: 102, name: 'VfL Kirchheim' },
    venue: {
      id: 501,
      name: 'HAKRO Arena',
      street: 'Haller Str. 75',
      postalCode: '74564',
      city: 'Crailsheim',
      latitude: 49.1342,
      longitude: 10.0712,
    },
    result: null,
    confirmed: true,
    distanceKm: 12.4,
  };

  it('generates all URLs for an upcoming match with coordinates and league details', () => {
    const links = getMatchLinks(baseMatch);

    expect(links.dbbMatchInfoUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765');
    expect(links.dbbBoxscoreUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765/boxscore');
    expect(links.dbbPlayByPlayUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765/playbyplay');
    expect(links.dbbStandingsUrl).toBe('https://www.basketball-bund.net/static/#/liga/54321/tabelle');
    expect(links.navigationUrl).toBe('https://www.google.com/maps/dir/?api=1&destination=49.1342,10.0712');
  });

  it('generates correct URLs for a finished match', () => {
    const finishedMatch: Match = {
      ...baseMatch,
      result: '82:76',
    };

    const links = getMatchLinks(finishedMatch);

    expect(links.dbbMatchInfoUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765');
    expect(links.dbbBoxscoreUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765/boxscore');
    expect(links.dbbPlayByPlayUrl).toBe('https://www.basketball-bund.net/static/#/spiel/98765/playbyplay');
  });

  it('returns null navigationUrl when venue is absent or undefined', () => {
    const matchWithoutVenue: Match = {
      ...baseMatch,
      venue: null,
    };

    const links = getMatchLinks(matchWithoutVenue);

    expect(links.navigationUrl).toBeNull();
  });

  it('falls back to encoded address when coordinates are missing (null or undefined)', () => {
    const matchWithoutCoords: Match = {
      ...baseMatch,
      venue: {
        id: 502,
        name: 'Sporthalle West',
        street: 'Bebelstraße 24',
        postalCode: '70193',
        city: 'Stuttgart',
        latitude: null,
        longitude: null,
      },
    };

    const links = getMatchLinks(matchWithoutCoords);
    const expectedAddress = encodeURIComponent('Sporthalle West, Bebelstraße 24, 70193 Stuttgart');

    expect(links.navigationUrl).toBe(`https://www.google.com/maps/dir/?api=1&destination=${expectedAddress}`);
  });

  it('returns null navigationUrl if venue has neither coordinates nor address text', () => {
    const matchEmptyVenue: Match = {
      ...baseMatch,
      venue: {
        id: 999,
        name: '',
        street: '',
        postalCode: '',
        city: '',
        latitude: null,
        longitude: null,
      },
    };

    const links = getMatchLinks(matchEmptyVenue);

    expect(links.navigationUrl).toBeNull();
  });

  it('resolves league DBB ID from match.leagueId if match.league is omitted', () => {
    const matchWithoutLeagueObj: Match = {
      ...baseMatch,
      league: undefined,
      leagueId: 67890,
    };

    const links = getMatchLinks(matchWithoutLeagueObj);

    expect(links.dbbStandingsUrl).toBe('https://www.basketball-bund.net/static/#/liga/67890/tabelle');
  });

  it('returns null dbbStandingsUrl if neither league.dbbId nor leagueId is available', () => {
    const matchWithoutLeague: Match = {
      ...baseMatch,
      league: undefined,
      leagueId: 0,
    };

    const links = getMatchLinks(matchWithoutLeague);

    expect(links.dbbStandingsUrl).toBeNull();
  });
});
