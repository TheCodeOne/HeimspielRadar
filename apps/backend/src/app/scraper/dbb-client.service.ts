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
  kickoffDate: string; // 'YYYY-MM-DD'
  kickoffTime: string; // 'HH:mm'
  homeTeam: DbbTeam;
  guestTeam: DbbTeam;
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

@Injectable()
export class DbbClientService {
  private readonly logger = new Logger(DbbClientService.name);
  private readonly baseUrl = 'https://www.basketball-bund.net';
  private readonly defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
  };

  /**
   * Fetches the full schedule (spielplan) for a given competition/league.
   */
  async fetchSpielplan(ligaId: number): Promise<DbbSpielplanResponse> {
    const url = `${this.baseUrl}/rest/competition/spielplan/id/${ligaId}`;
    this.logger.debug(`Fetching spielplan from: ${url}`);

    const res = await fetch(url, { headers: this.defaultHeaders });

    if (!res.ok) {
      throw new Error(`Failed to fetch spielplan for league ${ligaId}: ${res.status} ${res.statusText}`);
    }

    // SAFETY: DBB REST API guarantees DbbSpielplanResponse payload schema
    return (await res.json()) as DbbSpielplanResponse;
  }

  /**
   * Fetches match details including venue (spielfeld), quarter scores, referees.
   */
  async fetchMatchInfo(matchId: number): Promise<DbbMatchInfoResponse> {
    const url = `${this.baseUrl}/rest/match/id/${matchId}/matchInfo`;
    this.logger.debug(`Fetching matchInfo for match: ${matchId}`);

    const res = await fetch(url, { headers: this.defaultHeaders });

    if (!res.ok) {
      throw new Error(`Failed to fetch matchInfo for match ${matchId}: ${res.status} ${res.statusText}`);
    }

    // SAFETY: DBB REST API guarantees DbbMatchInfoResponse payload schema
    return (await res.json()) as DbbMatchInfoResponse;
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
}
