import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export interface GeographyPoint {
  lng: number;
  lat: number;
}

function parseEwkbPoint(hex: string): GeographyPoint | null {
  try {
    const buf = Buffer.from(hex, 'hex');

    if (buf.length < 21) {
      return null;
    }

    const isLittleEndian = buf.readUInt8(0) === 1;
    const typeAndFlags = isLittleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
    const hasSrid = (typeAndFlags & 0x20000000) !== 0;
    const offset = hasSrid ? 9 : 5;

    if (buf.length < offset + 16) {
      return null;
    }

    const lng = isLittleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
    const lat = isLittleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);

    return { lng, lat };
  } catch {
    return null;
  }
}

export const geography = customType<{
  data: GeographyPoint | [number, number];
  driverData: string;
  config: { type?: string; srid?: number };
}>({
  dataType(config) {
    const type = config?.type ?? 'Point';
    const srid = config?.srid ?? 4326;

    return `geography(${type}, ${srid})`;
  },
  toDriver(value: GeographyPoint | [number, number]): string {
    if (Array.isArray(value)) {
      return `SRID=4326;POINT(${value[0]} ${value[1]})`;
    }

    return `SRID=4326;POINT(${value.lng} ${value.lat})`;
  },
  fromDriver(value: string): GeographyPoint | null {
    if (!value) {
      return null;
    }

    if (value.includes('POINT')) {
      const match = value.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);

      if (match) {
        return { lng: parseFloat(match[1]), lat: parseFloat(match[2]) };
      }
    }

    return parseEwkbPoint(value);
  },
});

export interface LeagueRawData {
  skName?: string;
  akName?: string;
  geschlecht?: string;
}

export const leagues = pgTable('leagues', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  dbbId: integer('dbb_id').unique().notNull(),
  name: text('name').notNull(),
  seasonId: integer('season_id'),
  seasonName: text('season_name'),
  verbandName: text('verband_name'),
  skName: text('sk_name'),
  akName: text('ak_name'),
  geschlecht: text('geschlecht'),
  rawData: jsonb('raw_data').$type<LeagueRawData>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  dbbId: integer('dbb_id').unique().notNull(),
  name: text('name').notNull(),
  shortName: text('short_name'),
  clubId: integer('club_id'),
  rawData: jsonb('raw_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const venues = pgTable(
  'venues',
  {
    id: integer('id').primaryKey(), // Using DBB spielfeld.id directly
    name: text('name').notNull(),
    street: text('street'),
    postalCode: text('postal_code'),
    city: text('city'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    location: geography('location', { type: 'Point', srid: 4326 }),
    geocodedAt: timestamp('geocoded_at'),
    rawData: jsonb('raw_data'),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('venues_location_idx').using('gist', table.location),
  ]
);

export const matches = pgTable('matches', {
  id: integer('id').primaryKey(), // Using DBB matchId directly
  leagueId: integer('league_id')
    .notNull()
    .references(() => leagues.id, { onDelete: 'cascade' }),
  matchDay: integer('match_day').notNull(),
  matchNo: integer('match_no'),
  kickoffDate: text('kickoff_date').notNull(), // 'YYYY-MM-DD'
  kickoffTime: text('kickoff_time'), // 'HH:mm'
  homeTeamId: integer('home_team_id')
    .notNull()
    .references(() => teams.id),
  guestTeamId: integer('guest_team_id')
    .notNull()
    .references(() => teams.id),
  venueId: integer('venue_id').references(() => venues.id),
  result: text('result'),
  confirmed: boolean('confirmed').default(false).notNull(),
  rawData: jsonb('raw_data'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const leaguesRelations = relations(leagues, ({ many }) => ({
  matches: many(matches),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  homeMatches: many(matches, { relationName: 'homeTeam' }),
  guestMatches: many(matches, { relationName: 'guestTeam' }),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  matches: many(matches),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  league: one(leagues, {
    fields: [matches.leagueId],
    references: [leagues.id],
  }),
  homeTeam: one(teams, {
    fields: [matches.homeTeamId],
    references: [teams.id],
    relationName: 'homeTeam',
  }),
  guestTeam: one(teams, {
    fields: [matches.guestTeamId],
    references: [teams.id],
    relationName: 'guestTeam',
  }),
  venue: one(venues, {
    fields: [matches.venueId],
    references: [venues.id],
  }),
}));
