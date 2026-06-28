import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface LocalConfig {
  databaseUrl?: string;
  dbSchema?: string;
}

const DATA_DIR = process.env.AISPLINTER_DATA_DIR || join(process.cwd(), '.aisplinter-data');

function configPath(): string {
  return join(DATA_DIR, 'config.json');
}

export function loadLocalConfig(): LocalConfig {
  const path = configPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as LocalConfig;
  } catch {
    return {};
  }
}

export function saveLocalConfig(config: LocalConfig): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(configPath(), JSON.stringify(config, null, 2), 'utf-8');
}

/** Optional Postgres schema (e.g. `aisplinter`) for same-database isolation. Unset = `public`. */
export function getDbSchema(): string | undefined {
  const fromEnv = process.env.AISPLINTER_DB_SCHEMA?.trim();
  if (fromEnv) return fromEnv;
  return loadLocalConfig().dbSchema?.trim() || undefined;
}

export function getDatabaseUrl(): string | undefined {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;
  return loadLocalConfig().databaseUrl?.trim() || undefined;
}

export function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech') || url.includes('neon.database');
}

export function isPostgresUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('postgres://') || u.startsWith('postgresql://');
}

export function validateDbSchemaName(schema: string | undefined): string | undefined {
  if (!schema?.trim()) return undefined;
  const name = schema.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      'AISPLINTER_DB_SCHEMA must be a valid Postgres identifier (letters, numbers, underscore)',
    );
  }
  return name;
}

export interface DatabaseSetupInput {
  databaseUrl: string;
  dbSchema?: string;
}

export function persistDatabaseSetup(input: DatabaseSetupInput): void {
  const schema = validateDbSchemaName(input.dbSchema);
  if (!process.env.DATABASE_URL?.trim()) {
    saveLocalConfig({
      ...loadLocalConfig(),
      databaseUrl: input.databaseUrl.trim(),
      dbSchema: schema,
    });
  }
  if (schema && !process.env.AISPLINTER_DB_SCHEMA?.trim()) {
    process.env.AISPLINTER_DB_SCHEMA = schema;
  }
}
