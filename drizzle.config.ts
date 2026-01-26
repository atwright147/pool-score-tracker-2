import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    // This allows the CLI to find the DB both locally and in Docker
    url: process.env.DATABASE_URL || 'data/local.db',
  },
});
