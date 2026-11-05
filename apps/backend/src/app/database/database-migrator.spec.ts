import { Logger } from '@nestjs/common';
import {
  applyDatabaseMigrations,
  checkObjectExists,
  DdlError,
  isDuplicateDdlError,
  makeStatementIdempotent,
  MigrationDatabase,
  parseDdlError,
  runResilientMigrations,
  syncLegacyMigrationTable,
} from './database-migrator';

class TestLogger extends Logger {
  override log = jest.fn();

  override warn = jest.fn();

  override error = jest.fn();
}

describe('database-migrator', () => {
  let mockLogger: TestLogger;

  beforeEach(() => {
    mockLogger = new TestLogger();
  });

  describe('parseDdlError', () => {
    it('should parse an Error instance with optional code property', () => {
      const err = new Error('custom error');
      const parsed = parseDdlError(err);

      expect(parsed.message).toBe('custom error');
      expect(parsed.code).toBeUndefined();

      const errWithCode = Object.assign(new Error('duplicate'), { code: '42701' });
      const parsedWithCode = parseDdlError(errWithCode);

      expect(parsedWithCode.code).toBe('42701');
      expect(parsedWithCode.message).toBe('duplicate');
    });

    it('should parse a plain object with code and message', () => {
      const parsed = parseDdlError({ code: '42P07', message: 'relation exists' });

      expect(parsed.code).toBe('42P07');
      expect(parsed.message).toBe('relation exists');
    });

    it('should convert null or empty values to empty object', () => {
      expect(parseDdlError(null).message).toBeUndefined();
    });
  });

  describe('isDuplicateDdlError', () => {
    it('should return true for known PostgreSQL duplicate error codes', () => {
      expect(isDuplicateDdlError({ code: '42701' })).toBe(true);
      expect(isDuplicateDdlError({ code: '42P07' })).toBe(true);
      expect(isDuplicateDdlError({ code: '42710' })).toBe(true);
      expect(isDuplicateDdlError({ code: '42P06' })).toBe(true);
    });

    it('should return true for error messages containing already exists or duplicate patterns', () => {
      expect(
        isDuplicateDdlError({
          message: 'column "featured_reason" of relation "matches" already exists',
        })
      ).toBe(true);
      expect(isDuplicateDdlError({ message: 'relation "venues" already exists' })).toBe(true);
      expect(isDuplicateDdlError({ message: 'duplicate column name' })).toBe(true);
    });

    it('should return false for unrelated errors or non-objects', () => {
      expect(isDuplicateDdlError({})).toBe(false);
      expect(isDuplicateDdlError({ code: '42P01', message: 'relation "foo" does not exist' })).toBe(
        false
      );
      expect(isDuplicateDdlError({ message: 'connection refused' })).toBe(false);
    });
  });

  describe('makeStatementIdempotent', () => {
    it('should transform ADD COLUMN without IF NOT EXISTS to ADD COLUMN IF NOT EXISTS', () => {
      const stmt = 'ALTER TABLE "matches" ADD COLUMN "featured_reason" text;';
      const result = makeStatementIdempotent(stmt);

      expect(result).toBe('ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_reason" text;');
    });

    it('should not duplicate IF NOT EXISTS when already present in ADD COLUMN', () => {
      const stmt = 'ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_reason" text;';
      const result = makeStatementIdempotent(stmt);

      expect(result).toBe('ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "featured_reason" text;');
    });

    it('should transform CREATE TABLE without IF NOT EXISTS', () => {
      const stmt = 'CREATE TABLE "sync_failures" ("id" serial);';
      const result = makeStatementIdempotent(stmt);

      expect(result).toBe('CREATE TABLE IF NOT EXISTS "sync_failures" ("id" serial);');
    });

    it('should not alter CREATE TABLE IF NOT EXISTS', () => {
      const stmt = 'CREATE TABLE IF NOT EXISTS "sync_failures" ("id" serial);';
      const result = makeStatementIdempotent(stmt);

      expect(result).toBe('CREATE TABLE IF NOT EXISTS "sync_failures" ("id" serial);');
    });

    it('should transform CREATE INDEX and CREATE UNIQUE INDEX without IF NOT EXISTS', () => {
      const idxStmt = 'CREATE INDEX "matches_idx" ON "matches" ("home_team_id");';
      expect(makeStatementIdempotent(idxStmt)).toBe(
        'CREATE INDEX IF NOT EXISTS "matches_idx" ON "matches" ("home_team_id");'
      );

      const uniqueIdxStmt = 'CREATE UNIQUE INDEX "leagues_uniq" ON "leagues" ("dbb_id");';
      expect(makeStatementIdempotent(uniqueIdxStmt)).toBe(
        'CREATE UNIQUE INDEX IF NOT EXISTS "leagues_uniq" ON "leagues" ("dbb_id");'
      );
    });
  });

  describe('checkObjectExists', () => {
    it('should check information_schema.columns when a column duplicate error occurs', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [{ exists_flag: 1 }] }),
      };

      const error: DdlError = {
        code: '42701',
        message: 'column "featured_reason" of relation "matches" already exists',
      };

      const exists = await checkObjectExists(mockDb, error);

      expect(exists).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should return false if catalog check yields no rows', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      };

      const error: DdlError = {
        code: '42701',
        message: 'column "featured_reason" of relation "matches" already exists',
      };

      const exists = await checkObjectExists(mockDb, error);

      expect(exists).toBe(false);
    });

    it('should check pg_class when a relation duplicate error occurs', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [{ exists_flag: 1 }] }),
      };

      const error: DdlError = {
        code: '42P07',
        message: 'relation "venues" already exists',
      };

      const exists = await checkObjectExists(mockDb, error);

      expect(exists).toBe(true);
    });

    it('should check pg_constraint when a constraint duplicate error occurs', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [{ exists_flag: 1 }] }),
      };

      const error: DdlError = {
        code: '42710',
        message: 'constraint "teams_primary_venue_id_venues_id_fk" for table "teams" already exists',
      };

      const exists = await checkObjectExists(mockDb, error);

      expect(exists).toBe(true);
    });
  });

  describe('syncLegacyMigrationTable', () => {
    it('should return early if public.__drizzle_migrations does not exist', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockImplementation((query) => {
          const sqlText = JSON.stringify(query);

          if (sqlText.includes('to_regclass')) {
            return Promise.resolve({ rows: [{ tbl: null }] });
          }

          return Promise.resolve({ rows: [] });
        }),
      };

      await syncLegacyMigrationTable(mockDb, mockLogger);

      expect(mockLogger.log).not.toHaveBeenCalled();
    });

    it('should sync records when public.__drizzle_migrations exists', async () => {
      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockImplementation((query) => {
          const sqlText = JSON.stringify(query);

          if (sqlText.includes('to_regclass')) {
            return Promise.resolve({ rows: [{ tbl: 'public.__drizzle_migrations' }] });
          }

          if (sqlText.includes('INSERT INTO drizzle.__drizzle_migrations')) {
            return Promise.resolve({ rows: [], rowCount: 5 });
          }

          return Promise.resolve({ rows: [] });
        }),
      };

      await syncLegacyMigrationTable(mockDb, mockLogger);

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Synced 5 legacy migration record(s) from public.__drizzle_migrations to drizzle.__drizzle_migrations.'
      );
    });
  });

  describe('runResilientMigrations', () => {
    it('should skip migrations that are already applied', async () => {
      const readMigrationFilesFn = jest.fn().mockReturnValue([
        {
          folderMillis: 1000,
          hash: 'hash1',
          sql: ['ALTER TABLE "matches" ADD COLUMN "test" text;'],
        },
      ]);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [{ created_at: '1000' }] }),
      };

      await runResilientMigrations(mockDb, 'migrations', mockLogger, { readMigrationFilesFn });

      expect(mockDb.execute).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).not.toHaveBeenCalledWith(expect.stringContaining('Applying migration'));
    });

    it('should apply unrecorded migrations idempotently and recover from duplicate column error if object exists', async () => {
      const readMigrationFilesFn = jest.fn().mockReturnValue([
        {
          folderMillis: 2000,
          hash: 'hash2',
          sql: [
            'ALTER TABLE "matches" ADD COLUMN "featured_reason" text;',
            'ALTER TABLE "matches" ADD COLUMN "featured_meta" jsonb;',
          ],
        },
      ]);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockImplementation((query) => {
          const rawSql = JSON.stringify(query);

          if (rawSql.includes('SELECT created_at FROM drizzle.__drizzle_migrations')) {
            return Promise.resolve({ rows: [] });
          }

          if (rawSql.includes('information_schema.columns')) {
            return Promise.resolve({ rows: [{ exists_flag: 1 }] });
          }

          if (rawSql.includes('featured_reason')) {
            const err = Object.assign(
              new Error('column "featured_reason" of relation "matches" already exists'),
              { code: '42701' }
            );

            throw err;
          }

          return Promise.resolve({ rows: [] });
        }),
      };

      await runResilientMigrations(mockDb, 'migrations', mockLogger, { readMigrationFilesFn });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('DDL object already exists')
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Migration 2000 recorded cleanly.')
      );
    });

    it('should rethrow if a migration statement fails with non-duplicate error', async () => {
      const readMigrationFilesFn = jest.fn().mockReturnValue([
        {
          folderMillis: 3000,
          hash: 'hash3',
          sql: ['SYNTAX ERROR;'],
        },
      ]);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockImplementation((query) => {
          const rawSql = JSON.stringify(query);

          if (rawSql.includes('SELECT created_at FROM drizzle.__drizzle_migrations')) {
            return Promise.resolve({ rows: [] });
          }

          throw new Error('syntax error near "SYNTAX"');
        }),
      };

      await expect(
        runResilientMigrations(mockDb, 'migrations', mockLogger, { readMigrationFilesFn })
      ).rejects.toThrow('syntax error near "SYNTAX"');
    });
  });

  describe('applyDatabaseMigrations', () => {
    it('should complete cleanly if standard migrate succeeds', async () => {
      const migrateFn = jest.fn().mockResolvedValue(undefined);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await applyDatabaseMigrations(mockDb, 'migrations', mockLogger, { migrateFn });

      expect(mockLogger.log).toHaveBeenCalledWith('Database migrations applied cleanly.');
    });

    it('should fallback to resilient migrations when duplicate DDL error is encountered', async () => {
      const ddlErr = Object.assign(
        new Error('column "featured_reason" of relation "matches" already exists'),
        { code: '42701' }
      );

      const migrateFn = jest.fn().mockRejectedValue(ddlErr);
      const readMigrationFilesFn = jest.fn().mockReturnValue([]);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await applyDatabaseMigrations(mockDb, 'migrations', mockLogger, {
        migrateFn,
        readMigrationFilesFn,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Standard migration encountered duplicate DDL collision')
      );
      expect(mockLogger.log).toHaveBeenCalledWith(
        'Database migrations successfully recovered and applied idempotently.'
      );
    });

    it('should rethrow non-duplicate migration errors', async () => {
      const fatalErr = new Error('database connection failed');
      const migrateFn = jest.fn().mockRejectedValue(fatalErr);

      const mockDb: MigrationDatabase = {
        execute: jest.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(
        applyDatabaseMigrations(mockDb, 'migrations', mockLogger, { migrateFn })
      ).rejects.toThrow('database connection failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to apply database migrations on startup:',
        fatalErr
      );
    });
  });
});
