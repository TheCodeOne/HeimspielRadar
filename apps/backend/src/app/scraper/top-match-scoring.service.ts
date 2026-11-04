import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNotNull, or } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { leagues, matches, teams, venues } from '../database/schema';
import type { TopMatchFactor, TopMatchScoringMeta } from '@sundayleague/shared-types';
import type { DbbTabelleEntry } from './dbb-client.service';

export type { TopMatchFactor, TopMatchScoringMeta };

export interface MatchScoreResult {
  matchId: number;
  leagueId: number;
  score: number;
  factors: TopMatchFactor[];
  reason: string;
  meta: TopMatchScoringMeta;
  distanceKm: number | null;
}

export interface TopMatchCalculationSummary {
  leaguesProcessed: number;
  matchesEvaluated: number;
  topMatchesFeatured: number;
  preservedAdminCount: number;
}

/**
 * Haversine formula to compute great-circle distance between two geographic coordinates in kilometers.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

/**
 * Comparator to sort evaluated match results deterministically:
 * 1. Higher score first
 * 2. Shorter derby distance first (e.g. 5.0 km before 13.2 km)
 * 3. Lower match ID as stable fallback
 */
export function compareMatchScoreResults(
  a: MatchScoreResult,
  b: MatchScoreResult
): number {
  // Tiebreaker 1: Höherer Score
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  // Tiebreaker 2: Bei reinem Distanz-Bonus gewinnt das Spiel mit der KÜRZEREN Derby-Distanz (z. B. 5.0 km vor 13.2 km)
  if (a.distanceKm != null && b.distanceKm != null) {
    if (a.distanceKm !== b.distanceKm) {
      return a.distanceKm - b.distanceKm;
    }
  } else if (a.distanceKm != null) {
    return -1;
  } else if (b.distanceKm != null) {
    return 1;
  }

  // Tiebreaker 3: Niedrigere Match-ID als stabiler deterministischer Fallback
  return a.matchId - b.matchId;
}

/**
 * Selects up to 2 featured top matches for a matchday:
 * - Exactly 1 match standard (highest score).
 * - A 2nd match qualifies only if its score is within 5 points of the top score AND score > 0.
 * - If multiple matches qualify or tie, compareMatchScoreResults tiebreakers apply and the result is capped at 2.
 */
export function selectTopMatches(
  evaluatedMatches: MatchScoreResult[]
): MatchScoreResult[] {
  if (evaluatedMatches.length === 0) {
    return [];
  }

  const sorted = [...evaluatedMatches].sort(compareMatchScoreResults);
  const topScore = sorted[0].score;

  // Standardmäßig genau 1 Spiel (das mit dem höchsten Score).
  // Ein 2. Spiel darf sich nur qualifizieren, wenn sein Score innerhalb von 5 Punkten zum Top-Score liegt UND der Score > 0 ist.
  const candidates = sorted.filter(
    (m) => m.score >= topScore - 5 && m.score > 0
  );

  if (candidates.length > 0) {
    return candidates.slice(0, 2);
  }

  return [sorted[0]];
}

interface MetaWithOptionalType {
  type?: string;
}

interface TableWithEntries {
  entries?: DbbTabelleEntry[];
}

@Injectable()
export class TopMatchScoringService {
  private readonly logger = new Logger(TopMatchScoringService.name);

  constructor(
    @Optional() @Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null
  ) {}

  /**
   * Evaluates top matches for upcoming matchdays across all active leagues and marks them as isFeatured.
   * Already manually pinned admin matches (type === 'admin' or no meta) are NEVER overridden.
   */
  async calculateTopMatches(): Promise<TopMatchCalculationSummary> {
    if (!this.db) {
      this.logger.warn('Top match calculation skipped: database is not configured.');

      return {
        leaguesProcessed: 0,
        matchesEvaluated: 0,
        topMatchesFeatured: 0,
        preservedAdminCount: 0,
      };
    }

    const todayStr = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Berlin',
    }).format(new Date());

    // Fetch all leagues that have upcoming matches
    const activeLeagues = await this.db
      .select({
        id: leagues.id,
        name: leagues.name,
        rawData: leagues.rawData,
      })
      .from(leagues);

    let leaguesProcessed = 0;
    let totalMatchesEvaluated = 0;
    let topMatchesFeatured = 0;
    let preservedAdminCount = 0;

    for (const league of activeLeagues) {
      // Find upcoming matches for this league (from today onwards, or unplayed)
      const upcomingMatches = await this.db
        .select({
          id: matches.id,
          matchDay: matches.matchDay,
          kickoffDate: matches.kickoffDate,
          kickoffTime: matches.kickoffTime,
          homeTeamId: matches.homeTeamId,
          guestTeamId: matches.guestTeamId,
          venueId: matches.venueId,
          isFeatured: matches.isFeatured,
          featuredReason: matches.featuredReason,
          featuredMeta: matches.featuredMeta,
          result: matches.result,
        })
        .from(matches)
        .where(
          and(
            eq(matches.leagueId, league.id),
            or(
              gte(matches.kickoffDate, todayStr),
              isNotNull(matches.kickoffDate)
            )
          )
        )
        .orderBy(asc(matches.kickoffDate), asc(matches.matchDay));

      // Filter to unplayed matches
      const unplayedMatches = upcomingMatches.filter((m) => !m.result);

      if (unplayedMatches.length === 0) {
        continue;
      }

      // Group by matchDay
      const matchesByDay = new Map<number, typeof unplayedMatches>();

      for (const m of unplayedMatches) {
        const day = m.matchDay;
        const list = matchesByDay.get(day) ?? [];
        list.push(m);
        matchesByDay.set(day, list);
      }

      // Collect team venue locations for derby distance calculation
      const teamIds = new Set<number>();

      for (const m of unplayedMatches) {
        teamIds.add(m.homeTeamId);
        teamIds.add(m.guestTeamId);
      }

      const teamVenueCoords = await this.getTeamVenueCoordinates(Array.from(teamIds));

      // Parse standings from league rawData.tabelle
      const rawTable = league.rawData?.tabelle;

      // SAFETY: DBB API standings table payload structure is either { entries: [...] } or direct array
      const standingsEntries: DbbTabelleEntry[] =
        Array.isArray(rawTable)
          ? /* SAFETY: rawTable is array of entries */ (rawTable as DbbTabelleEntry[])
          : (/* SAFETY: rawTable is table object with entries */ (rawTable as TableWithEntries | undefined)?.entries ?? []);

      // Build map from team dbbId or name to standings rank
      // Also build map from team internal DB id to rank
      const teamIdToRank = await this.mapTeamIdsToRanks(Array.from(teamIds), standingsEntries);

      leaguesProcessed++;

      for (const [matchDay, dayMatches] of matchesByDay.entries()) {
        totalMatchesEvaluated += dayMatches.length;

        const evaluatedMatches: MatchScoreResult[] = [];
        const adminMatches: number[] = [];

        for (const match of dayMatches) {
          // Check if already manually featured by admin
          // SAFETY: featuredMeta is stored as JSON in matches table and may carry { type: string }
          const meta = match.featuredMeta as MetaWithOptionalType | null;

          const isAdminFeatured =
            Boolean(match.isFeatured) &&
            (!meta || meta.type === 'admin' || match.featuredReason === 'Von Admin ausgewählt');

          if (isAdminFeatured) {
            adminMatches.push(match.id);
            preservedAdminCount++;
            continue;
          }

          const homeRank = teamIdToRank.get(match.homeTeamId) ?? null;
          const guestRank = teamIdToRank.get(match.guestTeamId) ?? null;
          const totalTeams = standingsEntries.length > 0 ? standingsEntries.length : null;

          // Calculate distance between primary venues of home & guest team
          const homeCoords = teamVenueCoords.get(match.homeTeamId);
          const guestCoords = teamVenueCoords.get(match.guestTeamId);
          let distanceKm: number | null = null;

          if (
            homeCoords?.lat != null &&
            homeCoords?.lng != null &&
            guestCoords?.lat != null &&
            guestCoords?.lng != null
          ) {
            distanceKm = calculateHaversineDistanceKm(
              homeCoords.lat,
              homeCoords.lng,
              guestCoords.lat,
              guestCoords.lng
            );
          }

          const scoreResult = this.computeMatchScore({
            matchId: match.id,
            leagueId: league.id,
            matchDay,
            homeRank,
            guestRank,
            totalTeams,
            distanceKm,
          });

          evaluatedMatches.push(scoreResult);
        }

        if (evaluatedMatches.length === 0) {
          continue;
        }

        const qualifyingTopMatches = selectTopMatches(evaluatedMatches);
        const topMatchIds = new Set(qualifyingTopMatches.map((m) => m.matchId));

        // Update matches in DB for this matchday
        const now = new Date();
        const featuredUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        for (const m of evaluatedMatches) {
          if (topMatchIds.has(m.matchId)) {
            await this.db
              .update(matches)
              .set({
                isFeatured: true,
                featuredUntil,
                featuredReason: m.reason,
                featuredMeta: m.meta,
                updatedAt: now,
              })
              .where(eq(matches.id, m.matchId));

            topMatchesFeatured++;
          } else {
            // If it was previously an algorithm top match, demote it; leave admin matches alone
            const dayMatchObj = dayMatches.find((dm) => dm.id === m.matchId);
            // SAFETY: featuredMeta is cast to check algorithm provenance
            const prevMeta = dayMatchObj?.featuredMeta as MetaWithOptionalType | null;
            const isPrevAlgoFeatured = Boolean(dayMatchObj?.isFeatured) && prevMeta?.type === 'algorithm';

            if (isPrevAlgoFeatured) {
              await this.db
                .update(matches)
                .set({
                  isFeatured: false,
                  featuredUntil: null,
                  featuredReason: null,
                  featuredMeta: null,
                  updatedAt: now,
                })
                .where(eq(matches.id, m.matchId));
            }
          }
        }
      }
    }

    return {
      leaguesProcessed,
      matchesEvaluated: totalMatchesEvaluated,
      topMatchesFeatured,
      preservedAdminCount,
    };
  }

  /**
   * Computes the deterministic score and factors for a match.
   */
  computeMatchScore(params: {
    matchId: number;
    leagueId: number;
    matchDay: number;
    homeRank: number | null;
    guestRank: number | null;
    totalTeams: number | null;
    distanceKm: number | null;
  }): MatchScoreResult {
    const { matchId, leagueId, matchDay, homeRank, guestRank, totalTeams, distanceKm } = params;
    const factors: TopMatchFactor[] = [];
    let score = 0;

    const hasStandings =
      homeRank != null &&
      guestRank != null &&
      totalTeams != null &&
      totalTeams > 0;

    if (hasStandings) {
      // 1. Rangsumme / Basis-Score aus Ligatabelle
      // Lower ranks are better. Max rank sum is ~ 2 * N.
      // Base score: 2 * totalTeams - (homeRank + guestRank)
      const rankSum = homeRank + guestRank;
      const basePoints = Math.max(0, 2 * totalTeams - rankSum);
      score += basePoints;
      factors.push({
        name: 'Tabellenplatzierung',
        points: basePoints,
        description: `Platz ${homeRank} vs. Platz ${guestRank}`,
      });

      // 2. Spitzenbonus (+15) wenn Platz 1 oder 2 involviert
      if (homeRank <= 2 || guestRank <= 2) {
        score += 15;
        factors.push({
          name: 'Spitzenbonus',
          points: 15,
          description:
            homeRank <= 2 && guestRank <= 2
              ? 'Spitzenspiel: Beide Teams auf Platz 1-2'
              : `Spitzenteam involviert (${homeRank <= 2 ? `Heim #${homeRank}` : `Gast #${guestRank}`})`,
        });
      }

      // 3. Tabellennachbarn (|R1 - R2| <= 1: +10)
      if (Math.abs(homeRank - guestRank) <= 1) {
        score += 10;
        factors.push({
          name: 'Tabellennachbarn',
          points: 10,
          description: `Direkte Tabellennachbarn (|${homeRank} - ${guestRank}| <= 1)`,
        });
      }
    }

    // 4. Derby-Bonus basierend auf Haversine-Distanz der Heim-Hallen (<15km: +25, <30km: +10)
    if (distanceKm != null) {
      if (distanceKm < 15) {
        score += 25;
        factors.push({
          name: 'Lokalderby',
          points: 25,
          description: `Extrem kurzes Lokalderby (${distanceKm} km Distanz)`,
        });
      } else if (distanceKm < 30) {
        score += 10;
        factors.push({
          name: 'Regionalderby',
          points: 10,
          description: `Regionalderby (${distanceKm} km Distanz)`,
        });
      }
    }

    // 5. Fallback bei Spieltag 1-3 bzw. unvollständiger Tabelle: reine Derby-Distanz
    if (!hasStandings && factors.length === 0) {
      if (matchDay <= 3) {
        factors.push({
          name: 'Saisonauftakt',
          points: 0,
          description: `Frühe Saisonphase (${matchDay}. Spieltag)`,
        });
      }
    }

    // Textuelle Aufschlüsselung zusammensetzen
    const reasonParts = factors.map((f) =>
      f.points > 0 ? `${f.name} (+${f.points})` : f.name
    );

    const reason =
      reasonParts.length > 0
        ? reasonParts.join(' • ')
        : 'Topspiel des Spieltags';

    const meta: TopMatchScoringMeta = {
      type: 'algorithm',
      score,
      factors,
      distanceKm,
      homeRank,
      guestRank,
      totalTeams,
    };

    return {
      matchId,
      leagueId,
      score,
      factors,
      reason,
      meta,
      distanceKm,
    };
  }

  /**
   * Retrieves venue coordinates for the primary venue (or any associated venue) of given team IDs.
   */
  private async getTeamVenueCoordinates(
    teamIds: number[]
  ): Promise<Map<number, { lat: number; lng: number }>> {
    const coordsMap = new Map<number, { lat: number; lng: number }>();

    if (!this.db || teamIds.length === 0) {
      return coordsMap;
    }

    const teamRows = await this.db
      .select({
        teamId: teams.id,
        primaryVenueId: teams.primaryVenueId,
        venueLat: venues.latitude,
        venueLng: venues.longitude,
      })
      .from(teams)
      .leftJoin(venues, eq(teams.primaryVenueId, venues.id))
      .where(inArray(teams.id, teamIds));

    for (const row of teamRows) {
      if (row.venueLat != null && row.venueLng != null) {
        coordsMap.set(row.teamId, {
          lat: Number(row.venueLat),
          lng: Number(row.venueLng),
        });
      }
    }

    return coordsMap;
  }

  /**
   * Maps internal team DB IDs to their league table rank.
   */
  private async mapTeamIdsToRanks(
    teamIds: number[],
    standingsEntries: DbbTabelleEntry[]
  ): Promise<Map<number, number>> {
    const rankMap = new Map<number, number>();

    if (!this.db || teamIds.length === 0 || standingsEntries.length === 0) {
      return rankMap;
    }

    const teamRows = await this.db
      .select({
        id: teams.id,
        dbbId: teams.dbbId,
        name: teams.name,
      })
      .from(teams)
      .where(inArray(teams.id, teamIds));

    for (const team of teamRows) {
      // Find matching standings entry by team dbbId first, then by name matching
      const entry =
        standingsEntries.find((e) => {
          const t = e.team;
          const entryDbbId = t?.seasonTeamId ?? t?.teamCompetitionId ?? t?.teamPermanentId;

          return entryDbbId === team.dbbId;
        }) ??
        standingsEntries.find(
          (e) =>
            e.team?.teamname &&
            (e.team.teamname.trim().toLowerCase() === team.name.trim().toLowerCase() ||
              team.name.toLowerCase().includes(e.team.teamname.toLowerCase()))
        );

      if (entry?.rang != null) {
        rankMap.set(team.id, Number(entry.rang));
      }
    }

    return rankMap;
  }
}
