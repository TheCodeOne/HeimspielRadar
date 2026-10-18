import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { Match, NearbyMatchesQuery } from '@sundayleague/shared-types';
import { DRIZZLE_DB, DrizzleDb } from '../database/database.module';
import { leagues, matches, teams, venues } from '../database/schema';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  /**
   * Search matches for map display by date, coordinates (lat/lng), radius in km, or league.
   */
  async findMatches(query: NearbyMatchesQuery): Promise<Match[]> {
    if (!this.db) {
      throw new Error('Database is not configured! Please configure DATABASE_URL in .env.');
    }

    const { date, lat, lng, radiusKm = 30, leagueId } = query;

    const conditions = [];
    if (date) {
      conditions.push(eq(matches.kickoffDate, date));
    }
    if (leagueId) {
      conditions.push(eq(matches.leagueId, leagueId));
    }

    const rows = await this.db.query.matches.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        league: true,
        homeTeam: true,
        guestTeam: true,
        venue: true,
      },
    });

    const results: Match[] = rows.map((r) => {
      let distanceKm: number | undefined;

      if (
        lat !== undefined &&
        lng !== undefined &&
        r.venue?.latitude !== null &&
        r.venue?.latitude !== undefined &&
        r.venue?.longitude !== null &&
        r.venue?.longitude !== undefined
      ) {
        distanceKm = this.calculateHaversineDistance(
          lat,
          lng,
          r.venue.latitude,
          r.venue.longitude
        );
      }

      return {
        id: r.id,
        leagueId: r.leagueId,
        matchDay: r.matchDay,
        matchNo: r.matchNo ?? undefined,
        kickoffDate: r.kickoffDate,
        kickoffTime: r.kickoffTime ?? '00:00',
        homeTeam: {
          id: r.homeTeam.id,
          dbbId: r.homeTeam.dbbId,
          name: r.homeTeam.name,
          shortName: r.homeTeam.shortName ?? undefined,
          clubId: r.homeTeam.clubId ?? undefined,
        },
        guestTeam: {
          id: r.guestTeam.id,
          dbbId: r.guestTeam.dbbId,
          name: r.guestTeam.name,
          shortName: r.guestTeam.shortName ?? undefined,
          clubId: r.guestTeam.clubId ?? undefined,
        },
        venue: r.venue
          ? {
              id: r.venue.id,
              name: r.venue.name,
              street: r.venue.street ?? '',
              postalCode: r.venue.postalCode ?? '',
              city: r.venue.city ?? '',
              latitude: r.venue.latitude,
              longitude: r.venue.longitude,
              geocodedAt: r.venue.geocodedAt ? r.venue.geocodedAt.toISOString() : null,
            }
          : null,
        result: r.result,
        confirmed: r.confirmed,
        distanceKm,
      };
    });

    // If spatial coordinates are given, filter by radius and sort by nearest
    if (lat !== undefined && lng !== undefined) {
      return results
        .filter((m) => m.distanceKm !== undefined && m.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    return results;
  }

  /**
   * Find single match by ID.
   */
  async findById(matchId: number): Promise<Match | null> {
    if (!this.db) {
      throw new Error('Database is not configured!');
    }

    const row = await this.db.query.matches.findFirst({
      where: eq(matches.id, matchId),
      with: {
        league: true,
        homeTeam: true,
        guestTeam: true,
        venue: true,
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      leagueId: row.leagueId,
      matchDay: row.matchDay,
      matchNo: row.matchNo ?? undefined,
      kickoffDate: row.kickoffDate,
      kickoffTime: row.kickoffTime ?? '00:00',
      homeTeam: {
        id: row.homeTeam.id,
        dbbId: row.homeTeam.dbbId,
        name: row.homeTeam.name,
      },
      guestTeam: {
        id: row.guestTeam.id,
        dbbId: row.guestTeam.dbbId,
        name: row.guestTeam.name,
      },
      venue: row.venue
        ? {
            id: row.venue.id,
            name: row.venue.name,
            street: row.venue.street ?? '',
            postalCode: row.venue.postalCode ?? '',
            city: row.venue.city ?? '',
            latitude: row.venue.latitude,
            longitude: row.venue.longitude,
          }
        : null,
      result: row.result,
      confirmed: row.confirmed,
    };
  }

  /**
   * Haversine formula to compute great-circle distance between two points in kilometers.
   */
  private calculateHaversineDistance(
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
    return Math.round(R * c * 10) / 10; // Round to 1 decimal place (e.g. 14.2 km)
  }
}
