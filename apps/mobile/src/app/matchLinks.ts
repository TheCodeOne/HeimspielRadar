import type { Match } from '@sundayleague/shared-types';

export interface MatchLinks {
  dbbMatchInfoUrl: string; // https://www.basketball-bund.net/static/#/spiel/{matchId}
  dbbBoxscoreUrl: string; // https://www.basketball-bund.net/static/#/spiel/{matchId}/boxscore
  dbbPlayByPlayUrl: string; // https://www.basketball-bund.net/static/#/spiel/{matchId}/playbyplay
  dbbStandingsUrl: string | null; // https://www.basketball-bund.net/static/#/liga/{dbbLeagueId}/tabelle
  navigationUrl: string | null; // https://www.google.com/maps/dir/?api=1&destination={lat},{lng}
}

function getNavigationUrl(venue?: Match['venue'] | null): string | null {
  if (!venue) {
    return null;
  }

  if (venue.latitude != null && venue.longitude != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`;
  }

  const postalCity = [venue.postalCode, venue.city].filter(Boolean).join(' ').trim();
  const addressParts = [venue.name, venue.street, postalCity].filter(Boolean);

  if (addressParts.length === 0) {
    return null;
  }

  const destination = addressParts.join(', ');

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function getMatchLinks(match: Match): MatchLinks {
  // SAFETY: Match fixtures in tests or partial payloads may have optional leagueId fallback
  const matchWithOptionalLeagueId = match as Partial<Match>;
  const dbbLeagueId = match.league?.dbbId ?? matchWithOptionalLeagueId.leagueId;

  const dbbStandingsUrl =
    dbbLeagueId != null && dbbLeagueId > 0
      ? `https://www.basketball-bund.net/static/#/liga/${dbbLeagueId}/tabelle`
      : null;

  return {
    dbbMatchInfoUrl: `https://www.basketball-bund.net/static/#/spiel/${match.id}`,
    dbbBoxscoreUrl: `https://www.basketball-bund.net/static/#/spiel/${match.id}/boxscore`,
    dbbPlayByPlayUrl: `https://www.basketball-bund.net/static/#/spiel/${match.id}/playbyplay`,
    dbbStandingsUrl,
    navigationUrl: getNavigationUrl(match.venue),
  };
}
