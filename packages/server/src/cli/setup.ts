#!/usr/bin/env node
/**
 * AISplinter setup CLI — same flows as the web wizard, for terminal / CI / VS Code tasks.
 *
 * Usage:
 *   npx @aisplinter/server setup status
 *   npx @aisplinter/server setup database --url "$DATABASE_URL" [--schema aisplinter]
 *   npx @aisplinter/server setup database --interactive
 *   npx @aisplinter/server setup init --name MyApp --adapter openrouter --openrouter-key sk-or-…
 */
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { count } from 'drizzle-orm';
import { createProject } from '../bootstrap/project.js';
import { connectAisplinterDatabase, readConfiguredDatabase } from '../setup/database.js';
import { getDb, initDatabase, isDatabaseReady } from '../db/index.js';
import { describeDatabaseTarget } from '../db/migrate.js';
import { projects } from '../db/schema.js';
import { getDatabaseUrl, getDbSchema, validateDbSchemaName } from '../config.js';
import { canBootstrapFromEnv } from '../bootstrap/envSetup.js';

function usage(): void {
  console.log(`
AISplinter setup CLI

Commands:
  status                         Show database + project setup state
  database --url <postgres-url>  Connect Postgres and run migrations
           [--schema <name>]     Optional Postgres schema (e.g. aisplinter)
           --interactive         Prompt for URL and schema
  init                           Create AISplinter project (after database)
           --name <name>
           --adapter openrouter|litellm
           --openrouter-key <key>
           --litellm-key <key> --litellm-base-url <url>

Examples:
  aisplinter-setup database --interactive
  aisplinter-setup database --url "$DATABASE_URL" --schema aisplinter
  aisplinter-setup init --name MyApp --adapter openrouter --openrouter-key "$AISPLINTER_OPENROUTER_KEY"

Web wizard: http://127.0.0.1:8747/ (standalone) or your embed /api/aisplinter/
Neon OAuth:  configure NEON_OAUTH_CLIENT_ID + NEON_OAUTH_CLIENT_SECRET, then use the web wizard.
`);
}

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [, , command = 'help', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    }
  }
  return { command, flags };
}

async function cmdStatus(): Promise<void> {
  const configured = readConfiguredDatabase();
  let projectCount: number | null = null;
  let dbError: string | null = null;

  if (configured.databaseUrl) {
    try {
      await initDatabase(configured.databaseUrl, configured.dbSchema);
      projectCount = (await getDb().select({ value: count() }).from(projects))[0]?.value ?? 0;
    } catch (err: unknown) {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }

  console.log(
    JSON.stringify(
      {
        databaseUrlConfigured: !!configured.databaseUrl,
        dbSchema: configured.dbSchema ?? null,
        databaseTarget: configured.databaseUrl
          ? describeDatabaseTarget(configured.dbSchema)
          : null,
        databaseReady: isDatabaseReady() && !dbError,
        databaseError: dbError,
        projectCount,
        setupRequired: projectCount === 0,
        canBootstrapFromEnv: canBootstrapFromEnv(),
      },
      null,
      2,
    ),
  );
}

async function cmdDatabase(flags: Record<string, string | boolean>): Promise<void> {
  let databaseUrl = typeof flags.url === 'string' ? flags.url : getDatabaseUrl();
  let dbSchema =
    typeof flags.schema === 'string' ? validateDbSchemaName(flags.schema) : getDbSchema();

  if (flags.interactive) {
    const rl = createInterface({ input, output });
    try {
      databaseUrl =
        (await rl.question('Postgres DATABASE_URL: ')).trim() || databaseUrl || '';
      const schemaAnswer = (await rl.question(
        'Postgres schema (optional, e.g. aisplinter — Enter to skip): ',
      )).trim();
      if (schemaAnswer) {
        dbSchema = validateDbSchemaName(schemaAnswer);
      }
    } finally {
      rl.close();
    }
  }

  if (!databaseUrl?.trim()) {
    throw new Error('Missing DATABASE_URL — pass --url or use --interactive');
  }

  const result = await connectAisplinterDatabase({
    databaseUrl,
    dbSchema,
    persist: true,
  });

  console.log(`Database connected (${result.target}).`);
  console.log('Next: aisplinter-setup init …  or open the web wizard upstream step.');
}

async function cmdInit(flags: Record<string, string | boolean>): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error('Configure database first: aisplinter-setup database …');
  }
  if (!isDatabaseReady()) {
    await initDatabase(url, getDbSchema());
  }

  const existing = (await getDb().select({ value: count() }).from(projects))[0]?.value ?? 0;
  if (existing > 0) {
    throw new Error('Setup already completed — project exists in database');
  }

  const name = typeof flags.name === 'string' ? flags.name : 'MyApp';
  const upstreamAdapter =
    typeof flags.adapter === 'string' ? flags.adapter : 'openrouter';

  if (upstreamAdapter !== 'openrouter' && upstreamAdapter !== 'litellm') {
    throw new Error('--adapter must be openrouter or litellm');
  }

  const project = await createProject({
    name,
    upstreamAdapter,
    openrouterKey: typeof flags['openrouter-key'] === 'string' ? flags['openrouter-key'] : undefined,
    litellmKey: typeof flags['litellm-key'] === 'string' ? flags['litellm-key'] : undefined,
    litellmBaseUrl:
      typeof flags['litellm-base-url'] === 'string' ? flags['litellm-base-url'] : undefined,
  });

  console.log(JSON.stringify({ apiKey: project.apiKey, projectId: project.id }, null, 2));
  console.log(`Set AISPLINTER_DEV_KEY=${project.apiKey} in your server .env`);
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv);

  switch (command) {
    case 'status':
      await cmdStatus();
      break;
    case 'database':
      await cmdDatabase(flags);
      break;
    case 'init':
      await cmdInit(flags);
      break;
    case 'help':
    case '--help':
    case '-h':
      usage();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
