import { Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { DrizzleDb } from './database.module';

/**
 * Minimal database interface required for executing migration DDL and catalog checks.
 */
export type MigrationDatabase = {
  execute: DrizzleDb['execute'];
};

/**
 * Normalized database DDL error structure.
 */
export interface DdlError {
  code?: string;
  message?: string;
}

export interface MigrationFileEntry {
  folderMillis: number;
  hash: string;
  sql: string[];
}

export interface MigrationRunnerDeps {
  migrateFn?: (db: MigrationDatabase, config: { migrationsFolder: string }) => Promise<void>;
  readMigrationFilesFn?: (config: { migrationsFolder: string }) => MigrationFileEntry[];
}

/**
 * Parses a caught error into a structured DdlError.
 */
export function parseDdlError(error: Error | DdlError | null | undefined): DdlError {
  if (!error) {
    return {};
  }

  if (error instanceof Error) {
    // SAFETY: error was verified to contain 'code' property
    const code = 'code' in error ? String((error as Error & { code?: string }).code ?? '') : undefined;

    return { code: code || undefined, message: error.message };
  }

  return {
    code: error.code,
    message: error.message,
  };
}

/**
 * Checks whether an error thrown during migration is caused by an existing
 * database schema object (column, relation/table, constraint, index, or schema).
 */
export function isDuplicateDdlError(error: DdlError): boolean {
  const code = error.code;

  // PostgreSQL error codes:
  // 42701 = duplicate_column
  // 42P07 = duplicate_table / duplicate_relation
  // 42710 = duplicate_object (e.g. constraint or type)
  // 42P06 = duplicate_schema
  // 42704 = undefined_object (when dropping with conditional checks)
  if (code === '42701' || code === '42P07' || code === '42710' || code === '42P06') {
    return true;
  }

  const msg = String(error.message || '').toLowerCase();

  return (
    msg.includes('already exists') ||
    msg.includes('duplicate column') ||
    msg.includes('duplicate table') ||
    msg.includes('duplicate key')
  );
}

/**
 * Transforms non-idempotent SQL statements to idempotent variants where possible.
 */
export function makeStatementIdempotent(stmt: string): string {
  let transformed = stmt;

  // Replace "ADD COLUMN" without "IF NOT EXISTS"
  transformed = transformed.replace(
    /\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    'ADD COLUMN IF NOT EXISTS '
  );

  // Replace "CREATE TABLE" without "IF NOT EXISTS"
  transformed = transformed.replace(
    /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    'CREATE TABLE IF NOT EXISTS '
  );

  // Replace "CREATE [UNIQUE] INDEX" without "IF NOT EXISTS"
  transformed = transformed.replace(
    /\bCREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/gi,
    (_match, uniquePrefix: string | undefined) => `CREATE ${uniquePrefix || ''}INDEX IF NOT EXISTS `
  );

  return transformed;
}

/**
 * Verifies whether the object referenced in a duplicate DDL error actually exists
 * in the database catalogs.
 */
export async function checkObjectExists(
  db: MigrationDatabase,
  error: DdlError
): Promise<boolean> {
  const msg = String(error.message || '');

  // 1. Column duplicate pattern: column "featured_reason" of relation "matches" already exists
  const colMatch = msg.match(/column "(.*?)" of relation "(.*?)" already exists/i);

  if (colMatch) {
    const [, column, rawTable] = colMatch;
    const table = rawTable.replace(/^public\./, '').replace(/"/g, '');

    try {
      const res = await db.execute<{ exists_flag: number }>(sql`
        SELECT 1 as exists_flag FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = ${column}
        LIMIT 1;
      `);

      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  // 2. Relation / table duplicate pattern: relation "..." already exists
  const relMatch = msg.match(/relation "(.*?)" already exists/i);

  if (relMatch) {
    const [, rawRel] = relMatch;
    const rel = rawRel.replace(/^public\./, '').replace(/"/g, '');

    try {
      const res = await db.execute<{ exists_flag: number }>(sql`
        SELECT 1 as exists_flag FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = ${rel} AND n.nspname IN ('public', 'drizzle')
        LIMIT 1;
      `);

      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  // 3. Constraint duplicate pattern: constraint "..."
  const constraintMatch = msg.match(/constraint "(.*?)"/i);

  if (constraintMatch) {
    const [, constraint] = constraintMatch;

    try {
      const res = await db.execute<{ exists_flag: number }>(sql`
        SELECT 1 as exists_flag FROM pg_constraint WHERE conname = ${constraint} LIMIT 1;
      `);

      return res.rows.length > 0;
    } catch {
      return false;
    }
  }

  return isDuplicateDdlError(error);
}

/**
 * Pre-flight synchronization: Ensures drizzle schema and __drizzle_migrations table exist.
 * If legacy migrations were recorded in public.__drizzle_migrations, syncs them to drizzle.__drizzle_migrations
 * so drizzle-orm doesn't re-run already executed migrations.
 */
export async function syncLegacyMigrationTable(
  db: MigrationDatabase,
  logger: Logger
): Promise<void> {
  try {
    await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle;`);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      );
    `);

    // Check if public.__drizzle_migrations exists
    const checkPublic = await db.execute<{ tbl: string | null }>(
      sql`SELECT to_regclass('public.__drizzle_migrations') as tbl;`
    );

    const hasPublicTable = Boolean(checkPublic.rows[0]?.tbl);

    if (!hasPublicTable) {
      return;
    }

    const copyResult = await db.execute(sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      SELECT p.hash, p.created_at
      FROM public.__drizzle_migrations p
      WHERE NOT EXISTS (
        SELECT 1 FROM drizzle.__drizzle_migrations d
        WHERE d.created_at = p.created_at
      );
    `);

    const count = copyResult.rowCount ?? 0;

    if (count > 0) {
      logger.log(
        `Synced ${count} legacy migration record(s) from public.__drizzle_migrations to drizzle.__drizzle_migrations.`
      );
    }
  } catch (err) {
    logger.warn('Pre-flight legacy migration sync skipped or encountered non-critical error:', err);
  }
}

/**
 * Fallback runner that iterates through unapplied migrations statement-by-statement,
 * ensuring statements are idempotent and handling already-existing schema objects gracefully.
 */
export async function runResilientMigrations(
  db: MigrationDatabase,
  migrationsFolder: string,
  logger: Logger,
  deps: MigrationRunnerDeps = {}
): Promise<void> {
  const readFn = deps.readMigrationFilesFn ?? readMigrationFiles;
  const migrations = readFn({ migrationsFolder });

  // Fetch all already executed migration timestamps
  const dbMigrations = await db.execute<{ created_at: string | number }>(
    sql`SELECT created_at FROM drizzle.__drizzle_migrations;`
  );

  const appliedTimestamps = new Set<string>(
    dbMigrations.rows.map((r) => String(r.created_at))
  );

  for (const migration of migrations) {
    const millisStr = String(migration.folderMillis);

    if (appliedTimestamps.has(millisStr)) {
      continue;
    }

    logger.log(`Applying migration ${migration.folderMillis} idempotently...`);

    for (const stmt of migration.sql) {
      const idempotentStmt = makeStatementIdempotent(stmt);

      try {
        await db.execute(sql.raw(idempotentStmt));
      } catch (err) {
        // SAFETY: Postgres runtime error
        const ddlError = parseDdlError(err as Error);

        if (isDuplicateDdlError(ddlError)) {
          const exists = await checkObjectExists(db, ddlError);

          if (exists) {
            const message = ddlError.message || 'Object already exists';
            logger.warn(
              `DDL object already exists (${message}). Safely skipping statement in migration ${migration.folderMillis}.`
            );

            continue;
          }
        }

        const errMsg = ddlError.message || String(err);
        logger.error(
          `Migration statement failed in migration ${migration.folderMillis}: ${errMsg}`
        );
        throw err;
      }
    }

    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES (${migration.hash}, ${migration.folderMillis});`
    );
    appliedTimestamps.add(millisStr);
    logger.log(`Migration ${migration.folderMillis} recorded cleanly.`);
  }
}

/**
 * Main migration entry point:
 * 1. Runs pre-flight checks and schema syncing.
 * 2. Attempts standard drizzle migrate.
 * 3. On duplicate DDL collisions (e.g. column or table already exists), recovers gracefully
 *    via resilient statement execution so production startup is never blocked.
 */
export async function applyDatabaseMigrations(
  db: MigrationDatabase,
  migrationsFolder: string,
  logger: Logger,
  deps: MigrationRunnerDeps = {}
): Promise<void> {
  // Pre-flight sync
  await syncLegacyMigrationTable(db, logger);

  const doMigrate = deps.migrateFn;

  try {
    logger.log(`Applying database migrations from ${migrationsFolder}...`);

    if (doMigrate) {
      await doMigrate(db, { migrationsFolder });
    } else {
      // SAFETY: db runtime instance is DrizzleDb when called from DatabaseModule
      await migrate(db as DrizzleDb, { migrationsFolder });
    }

    logger.log('Database migrations applied cleanly.');
  } catch (error) {
    // SAFETY: Caught runtime error from migrate
    const ddlError = parseDdlError(error as Error);

    if (isDuplicateDdlError(ddlError)) {
      const message = ddlError.message || 'DDL duplicate collision';
      logger.warn(
        `Standard migration encountered duplicate DDL collision: ${message}. Initiating resilient idempotent migration recovery...`
      );
      await runResilientMigrations(db, migrationsFolder, logger, deps);
      logger.log('Database migrations successfully recovered and applied idempotently.');
    } else {
      logger.error('Failed to apply database migrations on startup:', error);
      throw error;
    }
  }
}
