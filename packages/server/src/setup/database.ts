import {
  getDatabaseUrl,
  getDbSchema,
  isPostgresUrl,
  persistDatabaseSetup,
  validateDbSchemaName,
} from '../config.js';
import { closeDatabase, initDatabase } from '../db/index.js';
import { describeDatabaseTarget, testDatabaseConnection } from '../db/migrate.js';

export interface ConnectDatabaseOptions {
  databaseUrl: string;
  dbSchema?: string;
  /** When true, write URL/schema to local config if not in process env. Default true. */
  persist?: boolean;
}

export interface ConnectDatabaseResult {
  databaseReady: true;
  target: string;
}

export async function connectAisplinterDatabase(
  options: ConnectDatabaseOptions,
): Promise<ConnectDatabaseResult> {
  const databaseUrl = options.databaseUrl.trim();
  if (!databaseUrl) {
    throw new Error('Missing databaseUrl');
  }
  if (!isPostgresUrl(databaseUrl)) {
    throw new Error('Use a postgres:// or postgresql:// connection string');
  }

  const dbSchema = validateDbSchemaName(options.dbSchema ?? getDbSchema());
  await testDatabaseConnection(databaseUrl, dbSchema);

  if (options.persist !== false) {
    persistDatabaseSetup({ databaseUrl, dbSchema });
  }

  await closeDatabase();
  await initDatabase(databaseUrl, dbSchema);

  return {
    databaseReady: true,
    target: describeDatabaseTarget(dbSchema),
  };
}

export function readConfiguredDatabase(): {
  databaseUrl?: string;
  dbSchema?: string;
} {
  return {
    databaseUrl: getDatabaseUrl(),
    dbSchema: getDbSchema(),
  };
}
