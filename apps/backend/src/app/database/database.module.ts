import { Global, Inject, Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_DB = 'DRIZZLE_DB';

export type DrizzleDb = NodePgDatabase<typeof schema>;

function resolveMigrationsFolder(): string | null {
  const candidate1 = path.resolve(process.cwd(), 'drizzle/migrations');

  if (fs.existsSync(candidate1)) {
    return candidate1;
  }

  const candidate2 = path.resolve(process.cwd(), '../../drizzle/migrations');

  if (fs.existsSync(candidate2)) {
    return candidate2;
  }

  return null;
}

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
export class DatabaseModule implements OnModuleInit {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDb | null) {}

  async onModuleInit(): Promise<void> {
    if (!this.db) {
      return;
    }

    const migrationsFolder = resolveMigrationsFolder();

    if (!migrationsFolder) {
      this.logger.warn('Migrations folder not found, skipping startup migration.');

      return;
    }

    try {
      this.logger.log(`Applying database migrations from ${migrationsFolder}...`);
      await migrate(this.db, { migrationsFolder });
      this.logger.log('Database migrations applied cleanly.');
    } catch (error) {
      this.logger.error('Failed to apply database migrations on startup:', error);
      throw error;
    }
  }
}
