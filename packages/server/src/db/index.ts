import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import {
  getDatabaseUrl,
  getDbSchema,
  isNeonUrl,
  validateDbSchemaName,
} from '../config.js';
import { runMigrations } from './migrate.js';

let client: ReturnType<typeof postgres> | null = null;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export function isDatabaseReady(): boolean {
  return dbInstance !== null;
}

function connectionOptions(databaseUrl: string, dbSchema?: string) {
  const schema = validateDbSchemaName(dbSchema ?? getDbSchema());
  return {
    ssl: isNeonUrl(databaseUrl) ? ('require' as const) : undefined,
    max: 10,
    connection: schema
      ? {
          search_path: `${schema},public`,
        }
      : undefined,
  };
}

export async function initDatabase(
  databaseUrl?: string,
  dbSchema?: string,
): Promise<void> {
  const url = (databaseUrl ?? getDatabaseUrl())?.trim();
  if (!url) {
    throw new Error('DATABASE_URL is not configured');
  }
  const schemaName = validateDbSchemaName(dbSchema ?? getDbSchema());

  if (dbInstance) {
    await closeDatabase();
  }

  await runMigrations(url, schemaName);

  client = postgres(url, connectionOptions(url, schemaName));
  dbInstance = drizzle(client, { schema });
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end({ timeout: 5 });
  }
  client = null;
  dbInstance = null;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

/** Drizzle handle — throws if DB is not initialized yet. */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { getDbSchema, validateDbSchemaName } from '../config.js';
export { describeDatabaseTarget } from './migrate.js';
