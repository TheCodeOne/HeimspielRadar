import type { Match, Venue } from '@sundayleague/shared-types';

export interface VenueGroup {
  venueId: number;
  venue: Venue;
  matches: Match[];
  isSelected: boolean;
}

export function groupMatchesByVenue(
  matches: Match[],
  selectedMatchId?: number | null,
): VenueGroup[] {
  const venueMap = new Map<number, VenueGroup>();

  for (const match of matches) {
    if (!match.venue || match.venue.latitude == null || match.venue.longitude == null) {
      continue;
    }

    const venueId = match.venue.id;
    const existing = venueMap.get(venueId);

    if (existing) {
      existing.matches.push(match);

      if (match.id === selectedMatchId) {
        existing.isSelected = true;
      }
    } else {
      venueMap.set(venueId, {
        venueId,
        venue: match.venue,
        matches: [match],
        isSelected: match.id === selectedMatchId,
      });
    }
  }

  return Array.from(venueMap.values());
}

export function formatLeagueName(leagueId: number, leagueName?: string): string {
  if (leagueName) {
    return leagueName;
  }

  if (leagueId === 1) {
    return 'Oberliga Württemberg';
  }

  if (leagueId === 2) {
    return 'Landesliga';
  }

  return `Liga #${leagueId}`;
}

