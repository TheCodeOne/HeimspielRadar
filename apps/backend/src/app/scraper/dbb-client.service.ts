import { Injectable, Logger } from '@nestjs/common';

export interface DbbTeam {
  seasonTeamId?: number;
  teamCompetitionId?: number;
  teamPermanentId?: number;
  teamname: string;
  teamnameSmall?: string;
  clubId?: number;
  verzicht?: boolean;
}

export interface DbbMatch {
  matchId: number;
  matchDay: number;
  matchNo?: number;
  kickoffDate: string | null; // 'YYYY-MM-DD'
  kickoffTime: string | null; // 'HH:mm'
  homeTeam: DbbTeam | null;
  guestTeam: DbbTeam | null;
  result?: string;
  ergebnisbestaetigt?: boolean;
}

export interface DbbLigaData {
  seasonId?: number;
  seasonName?: string;
  ligaId: number;
  liganame: string;
  liganr?: number;
  skName?: string;
  akName?: string;
  geschlecht?: string;
  verbandId?: number;
  verbandName?: string;
}

export interface DbbVenue {
  id: number;
  bezeichnung: string;
  strasse: string;
  plz: string;
  ort: string;
}

export interface DbbMatchInfoResponse {
  data: {
    matchId: number;
    matchInfo?: {
      spielfeld?: DbbVenue;
      topPerformances?: unknown[];
      srList?: unknown[];
    };
    matchResult?: {
      heimEndstand?: number;
      gastEndstand?: number;
      heimHalbzeitstand?: number;
      gastHalbzeitstand?: number;
    };
  };
}

export interface DbbSpielplanResponse {
  data: {
    ligaData: DbbLigaData;
    matches: DbbMatch[];
  };
}

export interface DbbWamLigaResponse {
  data: {
    startAtIndex: number;
    hasMoreData: boolean;
    size: number;
    ligen: DbbLigaData[];
  };
}

export interface DbbActualMatch extends DbbMatch {
  abgesagt?: boolean;
  verzicht?: boolean;
  matchInfo?: {
    spielfeld?: DbbVenue;
    topPerformances?: unknown[];
    srList?: unknown[];
  } | null;
  matchResult?: {
    heimEndstand?: number;
    gastEndstand?: number;
    heimHalbzeitstand?: number;
    gastHalbzeitstand?: number;
  } | null;
}

export interface DbbTabelleEntry {
  rang: number;
  team: DbbTeam;
  anzspiele: number;
  anzGewinnpunkte?: number;
  anzVerlustpunkte?: number;
  s: number;
  n: number;
  koerbe: number;
  gegenKoerbe: number;
  korbdiff: number;
}

export interface DbbKreuztabelleMatch {
  matchId?: number;
  result?: string | null;
  ergebnisbestaetigt?: boolean;
}

export interface DbbKreuztabelle {
  teams?: DbbTeam[];
  results?: Record<string, DbbKreuztabelleMatch>;
}

export interface DbbTeamStatistik {
  team?: DbbTeam;
  stats?: Record<string, number | string | null>;
}

export interface DbbCompetitionActualResponse {
  status?: string;
  message?: string;
  data: {
    prevSpieltag?: number | null;
    selSpieltag?: number | null;
    selSpielDatum?: string | null;
    nextSpieltag?: number | null;
    ligaData: DbbLigaData;
    spieltage?: unknown[] | null;
    matches: DbbActualMatch[];
    tabelle: {
      ligaData?: DbbLigaData | null;
      entries: DbbTabelleEntry[];
      bbl?: boolean;
    };
    kreuztabelle?: DbbKreuztabelle | null;
    teamStatistik?: DbbTeamStatistik | null;
  };
}

@Injectable()
export class DbbClientService {
  private readonly logger = new Logger(DbbClientService.name);
  private readonly baseUrl = 'https://www.basketball-bund.net';
  private readonly defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
  };

  /**
   * Helper method to fetch and parse JSON from the DBB REST API with default headers.
   */
  async fetchJson<T>(url: string, errorPrefix = 'Failed to fetch'): Promise<T> {
    this.logger.debug(`Fetching from: ${url}`);

    const res = await fetch(url, { headers: this.defaultHeaders });

    if (!res.ok) {
      throw new Error(`${errorPrefix}: ${res.status} ${res.statusText}`);
    }

    // SAFETY: DBB REST API guarantees payload conforms to requested type T
    return (await res.json()) as T;
  }

  /**
   * Fetches actual matchday fixtures, standings table, and cross-table for a competition.
   */
  async fetchCompetitionActual(
    liganr: number,
    rangeDays = 14
  ): Promise<DbbCompetitionActualResponse> {
    const url = `${this.baseUrl}/rest/competition/actual/id/${liganr}?rangeDays=${rangeDays}`;

    this.logger.debug(`Fetching competition actual from: ${url}`);

    return this.fetchJson<DbbCompetitionActualResponse>(
      url,
      `Failed to fetch competition actual for league ${liganr}`
    );
  }

  /**
   * Fetches the full schedule (spielplan) for a given competition/league.
   */
  async fetchSpielplan(ligaId: number): Promise<DbbSpielplanResponse> {
    const url = `${this.baseUrl}/rest/competition/spielplan/id/${ligaId}`;
    this.logger.debug(`Fetching spielplan from: ${url}`);

    return this.fetchJson<DbbSpielplanResponse>(
      url,
      `Failed to fetch spielplan for league ${ligaId}`
    );
  }

  /**
   * Fetches match details including venue (spielfeld), quarter scores, referees.
   */
  async fetchMatchInfo(matchId: number): Promise<DbbMatchInfoResponse> {
    const url = `${this.baseUrl}/rest/match/id/${matchId}/matchInfo`;
    this.logger.debug(`Fetching matchInfo for match: ${matchId}`);

    return this.fetchJson<DbbMatchInfoResponse>(
      url,
      `Failed to fetch matchInfo for match ${matchId}`
    );
  }

  /**
   * Fetches leagues for Baden-Württemberg (or specified verbandId) using WAM pagination.
   */
  async fetchWamLeagues(
    verbandId = 1,
    startAtIndex = 0
  ): Promise<DbbWamLigaResponse> {
    const url = `${this.baseUrl}/rest/wam/liga/list?startAtIndex=${startAtIndex}`;
    const payload = { token: 0, verbandIds: [verbandId] };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch WAM leagues at index ${startAtIndex}: ${res.status} ${res.statusText}`);
    }

    // SAFETY: DBB REST API guarantees DbbWamLigaResponse payload schema
    return (await res.json()) as DbbWamLigaResponse;
  }

  /**
   * Fetches all leagues for Baden-Württemberg (or specified verbandId) by paginating through WAM until complete.
   */
  async fetchAllWamLeagues(verbandId = 1): Promise<DbbLigaData[]> {
    this.logger.log(`Starting pagination to discover all leagues for verbandId: ${verbandId}`);
    let startIndex = 0;
    let hasMore = true;
    const allLeagues: DbbLigaData[] = [];

    while (hasMore) {
      this.logger.debug(`Fetching WAM leagues page starting at index ${startIndex}...`);
      const response = await this.fetchWamLeagues(verbandId, startIndex);
      const ligen = response.data?.ligen || [];

      if (ligen.length === 0) {
        break;
      }

      for (const liga of ligen) {
        allLeagues.push(liga);
      }

      hasMore = Boolean(response.data?.hasMoreData);
      startIndex += ligen.length;
    }

    this.logger.log(`Discovered ${allLeagues.length} total leagues for verbandId ${verbandId}`);

    return allLeagues;
  }

  /**
   * Fetches active leagues for an association (alias for fetchAllWamLeagues).
   */
  async fetchLeagues(verbandId = 1): Promise<DbbLigaData[]> {
    return this.fetchAllWamLeagues(verbandId);
  }
}

