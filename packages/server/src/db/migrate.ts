import postgres from 'postgres';
import {
  AISPLINTER_TABLES,
  LEGACY_TABLES,
  qualifyTable,
} from './tableNames.js';
import { getDbSchema, validateDbSchemaName } from '../config.js';

function escIdent(id: string): string {
  return `"${id.replace(/"/g, '""')}"`;
}

function buildCreateTablesSql(schema: string | undefined): string {
  const p = (table: string) => qualifyTable(schema, table);
  const projects = p(AISPLINTER_TABLES.projects);
  const users = p(AISPLINTER_TABLES.users);
  const entitlements = p(AISPLINTER_TABLES.entitlements);
  const usageLedger = p(AISPLINTER_TABLES.usageLedger);
  const webhookDeliveries = p(AISPLINTER_TABLES.webhookDeliveries);

  return `
CREATE TABLE IF NOT EXISTS ${projects} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  webhook_url TEXT,
  webhook_secret TEXT,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ${users} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ${projects}(id),
  external_user_id TEXT NOT NULL,
  upstream_key_ref TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aisplinter_user_project_external_idx ON ${users}(project_id, external_user_id);

CREATE TABLE IF NOT EXISTS ${entitlements} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ${users}(id),
  project_id UUID NOT NULL REFERENCES ${projects}(id),
  plan_sku TEXT NOT NULL,
  budget_usd_remaining DOUBLE PRECISION NOT NULL,
  budget_usd_total DOUBLE PRECISION NOT NULL,
  period TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS aisplinter_entitlements_user_id_unique ON ${entitlements}(user_id);

CREATE TABLE IF NOT EXISTS ${usageLedger} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ${users}(id),
  project_id UUID NOT NULL REFERENCES ${projects}(id),
  type TEXT NOT NULL,
  amount_usd DOUBLE PRECISION NOT NULL,
  model TEXT,
  prompt_tokens DOUBLE PRECISION,
  completion_tokens DOUBLE PRECISION,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aisplinter_usage_user_created_idx ON ${usageLedger}(user_id, created_at);

CREATE TABLE IF NOT EXISTS ${webhookDeliveries} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES ${projects}(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL,
  retry_count DOUBLE PRECISION NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;
}

async function tableExists(
  sql: postgres.Sql,
  schema: string | undefined,
  table: string,
): Promise<boolean> {
  const schemaName = schema ?? 'public';
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = ${schemaName} AND table_name = ${table}
    ) AS exists
  `;
  return rows[0]?.exists === true;
}

async function migrateLegacyTables(sql: postgres.Sql, schema: string | undefined): Promise<void> {
  const renames: { from: string; to: string }[] = [
    { from: LEGACY_TABLES.projects, to: AISPLINTER_TABLES.projects },
    { from: LEGACY_TABLES.users, to: AISPLINTER_TABLES.users },
    { from: LEGACY_TABLES.entitlements, to: AISPLINTER_TABLES.entitlements },
    { from: LEGACY_TABLES.usageLedger, to: AISPLINTER_TABLES.usageLedger },
    { from: LEGACY_TABLES.webhookDeliveries, to: AISPLINTER_TABLES.webhookDeliveries },
  ];

  for (const { from, to } of renames) {
    const hasLegacy = await tableExists(sql, schema, from);
    const hasNew = await tableExists(sql, schema, to);
    if (hasLegacy && !hasNew) {
      await sql.unsafe(
        `ALTER TABLE ${qualifyTable(schema, from)} RENAME TO ${escIdent(to)}`,
      );
    }
  }

  const entitlements = qualifyTable(schema, AISPLINTER_TABLES.entitlements);
  const usageLedger = qualifyTable(schema, AISPLINTER_TABLES.usageLedger);

  if (await tableExists(sql, schema, AISPLINTER_TABLES.entitlements)) {
    const col = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ${schema ?? 'public'}
          AND table_name = ${AISPLINTER_TABLES.entitlements}
          AND column_name = 'userId'
      ) AS exists
    `;
    if (col[0]?.exists) {
      await sql.unsafe(
        `ALTER TABLE ${entitlements} RENAME COLUMN "userId" TO user_id`,
      );
    }
  }

  if (await tableExists(sql, schema, AISPLINTER_TABLES.usageLedger)) {
    const col = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = ${schema ?? 'public'}
          AND table_name = ${AISPLINTER_TABLES.usageLedger}
          AND column_name = 'userId'
      ) AS exists
    `;
    if (col[0]?.exists) {
      await sql.unsafe(
        `ALTER TABLE ${usageLedger} RENAME COLUMN "userId" TO user_id`,
      );
    }
  }
}

function postgresClientOptions(databaseUrl: string, schema?: string) {
  return {
    ssl: databaseUrl.includes('neon.tech') ? ('require' as const) : undefined,
    max: 1,
    onnotice: () => {},
    connection: schema
      ? {
          search_path: `${schema},public`,
        }
      : undefined,
  };
}

export async function runMigrations(databaseUrl: string, dbSchema?: string): Promise<void> {
  const schema = validateDbSchemaName(dbSchema ?? getDbSchema());
  const sql = postgres(databaseUrl, postgresClientOptions(databaseUrl, schema));
  try {
    if (schema) {
      await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS ${escIdent(schema)}`);
    }
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    await migrateLegacyTables(sql, schema);
    await sql.unsafe(buildCreateTablesSql(schema));
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function testDatabaseConnection(
  databaseUrl: string,
  dbSchema?: string,
): Promise<void> {
  const schema = validateDbSchemaName(dbSchema ?? getDbSchema());
  const sql = postgres(databaseUrl, {
    ...postgresClientOptions(databaseUrl, schema),
    connect_timeout: 10,
  });
  try {
    await sql`SELECT 1 AS ok`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export function describeDatabaseTarget(dbSchema?: string): string {
  const schema = validateDbSchemaName(dbSchema ?? getDbSchema());
  if (schema) {
    return `schema "${schema}" (tables: aisplinter_*)`;
  }
  return 'public schema (tables: aisplinter_*)';
}
