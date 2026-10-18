import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const leagues = pgTable('leagues', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  dbbId: integer('dbb_id').unique().notNull(),
  name: text('name').notNull(),
  seasonId: integer('season_id'),
  seasonName: text('season_name'),
  verbandName: text('verband_name'),
  rawData: jsonb('raw_data'),
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

export const venues = pgTable('venues', {
  id: integer('id').primaryKey(), // Using DBB spielfeld.id directly
  name: text('name').notNull(),
  street: text('street'),
  postalCode: text('postal_code'),
  city: text('city'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  geocodedAt: timestamp('geocoded_at'),
  rawData: jsonb('raw_data'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
