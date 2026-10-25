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

export interface VerbandInfo {
  id: number;
  name: string;
  shortName: string;
  type: 'national' | 'regional' | 'state' | 'special';
  state?: string;
}

export const GERMAN_BASKETBALL_VERBAENDE: readonly VerbandInfo[] = [
  // Bundesligen & Nationale Wettbewerbe
  { id: 100, name: 'DBB Bundesligen', shortName: 'DBB', type: 'national' },
  { id: 29, name: 'Deutsche Meisterschaften & Pokale', shortName: 'DBB-DM', type: 'national' },

  // Regionalligen (4 Regionalverbände)
  { id: 30, name: 'Regionalliga Nord', shortName: 'RLN', type: 'regional' },
  { id: 31, name: 'Regionalliga Südwest', shortName: 'RLSW', type: 'regional' },
  { id: 32, name: 'Regionalliga Südost', shortName: 'RLSO', type: 'regional' },
  { id: 33, name: 'Regionalliga West', shortName: 'RLW', type: 'regional' },

  // 16 Landesverbände
  { id: 1, name: 'Basketballverband Baden-Württemberg', shortName: 'BBW', type: 'state', state: 'Baden-Württemberg' },
  { id: 2, name: 'Bayerischer Basketball-Verband', shortName: 'BBV', type: 'state', state: 'Bayern' },
  { id: 3, name: 'Berliner Basketball-Verband', shortName: 'BBV', type: 'state', state: 'Berlin' },
  { id: 4, name: 'Bremer Basketball-Verband', shortName: 'BBM', type: 'state', state: 'Bremen' },
  { id: 5, name: 'Hamburger Basketball-Verband', shortName: 'HBV', type: 'state', state: 'Hamburg' },
  { id: 6, name: 'Hessischer Basketball-Verband', shortName: 'HBV', type: 'state', state: 'Hessen' },
  { id: 7, name: 'Niedersächsischer Basketballverband', shortName: 'NBV', type: 'state', state: 'Niedersachsen' },
  { id: 8, name: 'Basketballverband Rheinland-Pfalz', shortName: 'BVRP', type: 'state', state: 'Rheinland-Pfalz' },
  { id: 9, name: 'Basketballverband Saar', shortName: 'BVS', type: 'state', state: 'Saarland' },
  { id: 10, name: 'Basketball-Verband Schleswig-Holstein', shortName: 'BVSH', type: 'state', state: 'Schleswig-Holstein' },
  { id: 11, name: 'Westdeutscher Basketball-Verband', shortName: 'WBV', type: 'state', state: 'Nordrhein-Westfalen' },
  { id: 12, name: 'Basketball-Verband Mecklenburg-Vorpommern', shortName: 'BVMV', type: 'state', state: 'Mecklenburg-Vorpommern' },
  { id: 13, name: 'Basketball-Verband Sachsen-Anhalt', shortName: 'BVSA', type: 'state', state: 'Sachsen-Anhalt' },
  { id: 14, name: 'Brandenburger Basketball-Verband', shortName: 'BBV', type: 'state', state: 'Brandenburg' },
  { id: 15, name: 'Basketball-Verband Sachsen', shortName: 'BVS', type: 'state', state: 'Sachsen' },
  { id: 16, name: 'Thüringer Basketball-Verband', shortName: 'TBV', type: 'state', state: 'Thüringen' },

  // Rollstuhlbasketball
  { id: 40, name: 'Deutscher Rollstuhlsportverband', shortName: 'DRS', type: 'special' },
] as const;
