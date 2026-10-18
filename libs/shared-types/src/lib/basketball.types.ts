export interface League {
  id: number;
  dbbId: number;
  name: string;
  seasonId?: number;
  seasonName?: string;
  verbandName?: string;
  skName?: string;
  akName?: string;
  geschlecht?: string;
}

export interface Team {
  id: number;
  dbbId: number;
  name: string;
  shortName?: string;
  clubId?: number;
}

export interface Venue {
  id: number; // spielfeld.id from DBB
  name: string;
  street: string;
  postalCode: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  geocodedAt?: string | null;
}

export interface Match {
  id: number; // matchId from DBB
  leagueId: number;
  matchDay: number;
  matchNo?: number;
  kickoffDate: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm
  homeTeam: Team;
  guestTeam: Team;
  venue?: Venue | null;
  result?: string | null;
  confirmed: boolean;
  distanceKm?: number;
}

export interface SyncResult {
  leagueId: number;
  leagueName: string;
  totalMatches: number;
  syncedMatches: number;
  syncedVenues: number;
  geocodedVenues: number;
  durationMs: number;
}

export interface VerbandSyncResult {
  verbandId: number;
  totalLeagues: number;
  successfulLeagues: number;
  failedLeagues: number;
  totalMatches: number;
  syncedMatches: number;
  syncedVenues: number;
  geocodedVenues: number;
  durationMs: number;
  leagueResults?: SyncResult[];
}

export interface NearbyMatchesQuery {
  date?: string; // YYYY-MM-DD
  lat?: number;
  lng?: number;
  radiusKm?: number;
  leagueId?: number;
}

