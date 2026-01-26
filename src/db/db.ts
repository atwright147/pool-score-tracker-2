import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '~/db/schema';

// In a serverless env you'd handle this differently,
// but for self-hosting on a VPS, a single persistent connection is fine.
const sqlite = new Database(
	process.env.DATABASE_URL?.replace('file:', '') || 'data/local.db',
);

export const db = drizzle(sqlite, { schema });
