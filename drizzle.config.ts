import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Merge .env.local (takes precedence) and .env
dotenv.config({ path: '.env.local' });

dotenv.config({ path: '.env' });

export default defineConfig({
  schema: './apps/backend/src/app/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
