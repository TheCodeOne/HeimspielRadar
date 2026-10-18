import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_DB = 'DRIZZLE_DB';

export type DrizzleDb = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const databaseUrl = configService.get<string>('DATABASE_URL') || process.env.DATABASE_URL;

        if (!databaseUrl) {
          logger.warn(
            '⚠️ DATABASE_URL is not configured! Please provide a DATABASE_URL in .env (e.g. from Neon Postgres).'
          );

          // Return null so the app can still boot for testing/preview endpoints
          return null;
        }

        try {
          const pool = new Pool({
            connectionString: databaseUrl,
            ssl: databaseUrl.includes('neon.tech') ? { rejectUnauthorized: false } : undefined,
          });

          logger.log('Connected to PostgreSQL database via Drizzle');

          return drizzle(pool, { schema });
        } catch (error) {
          logger.error('Failed to initialize database connection', error);

          return null;
        }
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
