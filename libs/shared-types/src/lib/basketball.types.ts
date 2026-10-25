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
  primaryVenueId?: number | null;
}

export interface TeamSuggestion {
  id: number;
  name: string;
  shortName?: string | null;
  clubId?: number | null;
  akName?: string | null;
  geschlecht?: string | null;
  matchCount?: number;
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
  league?: League;
  matchDay: number;
  matchNo?: number;
  kickoffDate: string | null; // YYYY-MM-DD
  kickoffTime: string | null; // HH:mm
  homeTeam: Team;
  guestTeam: Team;
  venue?: Venue | null;
  isVenueVerified?: boolean;
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

export interface DeltaSyncResult {
  success: boolean;
  leagueId: number;
  leagueName: string;
  totalMatches: number;
  syncedMatches: number;
  matchesCount?: number;
  verifiedMatches: number;
  provisionalMatches: number;
  syncedVenues: number;
  geocodedVenues: number;
  durationMs: number;
}

export interface SyncVerbandDeltaResult {
  durationMs: number;
  successfulLeagues: number;
  totalLeagues: number;
  syncedMatches: number;
  errors: Array<{ leagueId: number; message: string }>;
  leagueResults?: DeltaSyncResult[];
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
  dateFrom?: string; // YYYY-MM-DD (inclusive start of range)
  dateTo?: string; // YYYY-MM-DD (inclusive end of range)
  teamQuery?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  leagueId?: number;
  leagueIds?: number[];
  genders?: string[];
  ageClasses?: string[];
  skillLevels?: string[];
  onlyUpcoming?: boolean;
}

export interface SyncFailure {
  id: number;
  entityType: 'league' | 'match' | string;
  dbbLeagueId: number;
  leagueName: string | null;
  dbbMatchId: number | null;
  verbandId: number | null;
  errorMessage: string;
  retryCount: number;
  failedAt: Date | string;
  updatedAt: Date | string;
}

export interface RetryFailedResult {
  retriedCount: number;
  resolvedCount: number;
  stillFailingCount: number;
  failures: SyncFailure[];
  retriedLeagues?: number;
  resolved?: number;
  stillFailing?: number;
}

export type SyncRunStatus = 'running' | 'success' | 'partial' | 'error';

export type SyncType = 'delta' | 'deep' | 'manual';

export interface SyncRun {
  id: number;
  syncType: string;
  target: string;
  startedAt: string | Date;
  finishedAt?: string | Date | null;
  durationMs?: number | null;
  totalLeagues: number;
  successfulLeagues: number;
  syncedMatches: number;
  geocodedVenues: number;
  failuresCount: number;
  status: SyncRunStatus | string;
  errorMessage?: string | null;
  createdAt: string | Date;
}

export interface AdminStatusResponse {
  uptimeSeconds: number;
  nodeVersion: string;
  memory: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
  databaseConnected: boolean;
  telegramConfigured: boolean;
  activeSyncRun: SyncRun | null;
  lastSyncRun: SyncRun | null;
}

export interface SyncTriggerDto {
  type: 'delta' | 'deep';
  target: 'all' | 'verband:1' | 'verband:31' | string;
}
