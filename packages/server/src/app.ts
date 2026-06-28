import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { count } from 'drizzle-orm';
import { readFile } from 'fs/promises';
import { bootstrapProjectFromEnv, createProject } from './bootstrap/project.js';
import { syncProjectUpstreamFromEnv } from './admin/project.js';
import { canBootstrapFromEnv, getEnvProjectConfig } from './bootstrap/envSetup.js';
import { getDefaultPlans } from './plans/catalog.js';
import { proxy } from './routes/proxy.js';
import { userRoutes } from './routes/users.js';
import { planRoutes } from './routes/plans.js';
import { adminRoutes, serveAdminHtml } from './routes/admin.js';
import { projects } from './db/schema.js';
import { closeDatabase, getDb, initDatabase } from './db/index.js';
import { getDatabaseUrl, getDbSchema } from './config.js';
import { resolvePublicFile } from './utils/publicFiles.js';
import {
  canBootstrapFromServerConfig,
  loadServerConfigFromEnv,
  type AisplinterServerConfig,
} from './env.js';
import { connectAisplinterDatabase } from './setup/database.js';
import {
  buildNeonAuthorizeUrl,
  consumeNeonOAuthState,
  createNeonOAuthState,
  exchangeNeonOAuthCode,
  isNeonOAuthConfigured,
  neonSetupDocsUrl,
  provisionNeonDatabaseForAisplinter,
} from './setup/neon.js';
import { describeDatabaseTarget } from './db/migrate.js';
import { escapeHtml } from './utils/escapeHtml.js';

type AppVars = {
  isSetupMode: boolean;
  databaseReady: boolean;
};

export interface CreateAisplinterAppOptions {
  /** Mount path when embedded (e.g. `/api/aisplinter`). Empty for standalone root. */
  basePath?: string;
  /** Override env-derived config (database URL, project bootstrap, data dir). */
  config?: Partial<AisplinterServerConfig>;
  /** Expose setup wizard routes (`/`, `/setup/*`). Default true. */
  setupWizard?: boolean;
  /** Enable CORS middleware. Default true. */
  cors?: boolean;
  /** Enable Hono request logger. Default false when embedded. */
  logger?: boolean;
  /** Skip env bootstrap on first empty DB. Default false. */
  skipEnvBootstrap?: boolean;
}

export interface AisplinterApp {
  app: Hono<{ Variables: AppVars }>;
  databaseReady: boolean;
  bootstrappedFromEnv: boolean;
}

function normalizeBasePath(basePath?: string): string {
  if (!basePath || basePath === '/') return '';
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function setupAbsoluteUrl(c: { req: { url: string } }, path: string, basePath?: string): string {
  const origin = new URL(c.req.url).origin;
  const prefix = normalizeBasePath(basePath);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${prefix}${suffix}`;
}

function applyServerConfigOverrides(overrides?: Partial<AisplinterServerConfig>): void {
  if (!overrides) return;
  if (overrides.dataDir) {
    process.env.AISPLINTER_DATA_DIR = overrides.dataDir;
  }
  if (overrides.databaseUrl && !process.env.DATABASE_URL?.trim()) {
    process.env.DATABASE_URL = overrides.databaseUrl;
  }
}

/**
 * Create a Hono app with AISplinter routes. Mount in any server that can call `app.fetch(request)`.
 */
export async function createAisplinterApp(
  options: CreateAisplinterAppOptions = {},
): Promise<AisplinterApp> {
  const {
    basePath,
    config: configOverrides,
    setupWizard = true,
    cors: enableCors = true,
    logger: enableLogger = !basePath,
    skipEnvBootstrap = false,
  } = options;

  applyServerConfigOverrides(configOverrides);

  const serverConfig = {
    ...loadServerConfigFromEnv(),
    ...configOverrides,
  };

  const app = new Hono<{ Variables: AppVars }>().basePath(normalizeBasePath(basePath));

  if (enableLogger) {
    app.use('*', logger());
  }
  if (enableCors) {
    app.use('*', cors());
  }

  async function bootstrapDatabase(): Promise<boolean> {
    const url = configOverrides?.databaseUrl ?? getDatabaseUrl();
    if (!url) return false;
    try {
      await initDatabase(url);
      return true;
    } catch (err) {
      console.error('Database initialization failed:', err);
      await closeDatabase();
      return false;
    }
  }

  let databaseReady = await bootstrapDatabase();
  let bootstrappedFromEnv = false;

  if (databaseReady && !skipEnvBootstrap) {
    try {
      const projectCount = await getDb().select({ value: count() }).from(projects);
      const shouldBootstrap =
        projectCount[0].value === 0 &&
        (canBootstrapFromEnv() || canBootstrapFromServerConfig(serverConfig));

      if (shouldBootstrap) {
        const created = await bootstrapProjectFromEnv();
        if (created) {
          bootstrappedFromEnv = true;
          console.log(`AISplinter bootstrapped from env — project "${created.name}"`);
          console.log(`Developer API key: ${created.apiKey}`);
          if (!process.env.AISPLINTER_DEV_KEY?.trim()) {
            console.log(
              'Tip: set AISPLINTER_DEV_KEY in .env so this key stays stable across DB resets.',
            );
          }
        }
      }
    } catch (err) {
      console.error('Env bootstrap failed:', err);
    }

    try {
      const synced = await syncProjectUpstreamFromEnv();
      if (synced) {
        console.log('AISplinter synced upstream keys from environment into project config');
      }
    } catch (err) {
      console.warn('AISplinter upstream env sync failed:', err);
    }
  }

  app.use('*', async (c, next) => {
    c.set('databaseReady', databaseReady);
    if (!databaseReady) {
      c.set('isSetupMode', true);
      return next();
    }

    const projectCount = await getDb().select({ value: count() }).from(projects);
    c.set('isSetupMode', projectCount[0].value === 0);
    await next();
  });

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      database: databaseReady,
      setupRequired: c.get('isSetupMode'),
    }),
  );

  if (setupWizard) {
    app.get('/', async (c) => {
      if (c.get('isSetupMode')) {
        const setupPath = await resolvePublicFile('setup.html');
        const html = await readFile(setupPath, 'utf-8');
        return c.html(html);
      }
      return c.redirect(`${normalizeBasePath(basePath) || ''}/admin`);
    });

    app.get('/setup/status', (c) => {
      return c.json({
        isSetupRequired: c.get('isSetupMode'),
        databaseConfigured: databaseReady || !!getDatabaseUrl(),
        databaseReady,
        dbSchema: getDbSchema() ?? null,
        databaseTarget: getDatabaseUrl() ? describeDatabaseTarget(getDbSchema()) : null,
        hasEnvDatabaseUrl: !!process.env.DATABASE_URL?.trim(),
        hasEnvDbSchema: !!process.env.AISPLINTER_DB_SCHEMA?.trim(),
        neonOAuthConfigured: isNeonOAuthConfigured(),
        neonOAuthDocsUrl: neonSetupDocsUrl(),
        canBootstrapFromEnv: canBootstrapFromEnv(),
        bootstrappedFromEnv,
        hasEnvDevKey: !!process.env.AISPLINTER_DEV_KEY?.trim(),
        cliHint: 'npx aisplinter-setup --help',
      });
    });

    app.get('/setup/plans', (c) => {
      const envConfig = getEnvProjectConfig();
      const adapter = envConfig?.upstreamAdapter ?? 'openrouter';
      const plans = getDefaultPlans(adapter).map((p) => ({
        sku: p.sku,
        displayName: p.displayName,
        description: p.description,
        budgetUsd: p.budgetUsd,
        period: p.period,
        priceLabel: p.priceLabel,
        highlighted: p.highlighted ?? false,
      }));
      return c.json({ plans, adapter });
    });

    app.post('/setup/database', async (c) => {
      if (databaseReady) {
        const projectCount = await getDb().select({ value: count() }).from(projects);
        if (projectCount[0].value > 0) {
          return c.json({ error: 'Setup already completed' }, 403);
        }
      }

      const body = await c.req.json<{ databaseUrl?: string; dbSchema?: string }>();
      const databaseUrl = body.databaseUrl?.trim();
      if (!databaseUrl) {
        return c.json({ error: 'Missing databaseUrl' }, 400);
      }

      try {
        const result = await connectAisplinterDatabase({
          databaseUrl,
          dbSchema: body.dbSchema,
          persist: true,
        });
        databaseReady = true;
        return c.json({
          message: 'Database connected',
          databaseReady: true,
          target: result.target,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Database connection failed';
        return c.json({ error: message }, 400);
      }
    });

    app.get('/setup/neon/authorize', (c) => {
      if (!isNeonOAuthConfigured()) {
        return c.json(
          {
            error: 'Neon OAuth is not configured on this server',
            hint: 'Set NEON_OAUTH_CLIENT_ID and NEON_OAUTH_CLIENT_SECRET — see docs/DATABASE.md',
            docsUrl: neonSetupDocsUrl(),
          },
          503,
        );
      }

      const dbSchema = c.req.query('dbSchema')?.trim() || undefined;
      const redirectAfter = c.req.query('redirect')?.trim() || '/';
      const redirectUri = setupAbsoluteUrl(c, '/setup/neon/callback', basePath);

      const state = createNeonOAuthState({ redirectAfter, dbSchema });
      const authorizeUrl = buildNeonAuthorizeUrl(redirectUri, state);
      return c.redirect(authorizeUrl);
    });

    app.get('/setup/neon/callback', async (c) => {
      const code = c.req.query('code');
      const state = c.req.query('state');
      const oauthError = c.req.query('error');

      if (oauthError) {
        return c.html(
          `<html><body><h1>Neon authorization failed</h1><p>${escapeHtml(oauthError)}</p><p><a href="${normalizeBasePath(basePath) || '/'}">Back to setup</a></p></body></html>`,
          400,
        );
      }

      if (!code || !state) {
        return c.json({ error: 'Missing Neon OAuth code or state' }, 400);
      }

      const pending = consumeNeonOAuthState(state);
      if (!pending) {
        return c.json({ error: 'Invalid or expired Neon OAuth state' }, 400);
      }

      const redirectUri = setupAbsoluteUrl(c, '/setup/neon/callback', basePath);

      try {
        const { accessToken } = await exchangeNeonOAuthCode(code, redirectUri);
        const neon = await provisionNeonDatabaseForAisplinter(accessToken);
        const result = await connectAisplinterDatabase({
          databaseUrl: neon.databaseUrl,
          dbSchema: pending.dbSchema,
          persist: true,
        });
        databaseReady = true;

        const setupRoot = `${normalizeBasePath(basePath) || ''}/`;
        const redirectTo = pending.redirectAfter?.startsWith('/')
          ? pending.redirectAfter
          : setupRoot;

        return c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Neon connected</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem">
  <h1>Neon database ready</h1>
  <p>Created Neon project <strong>${escapeHtml(neon.projectName)}</strong> in <em>your</em> Neon account.</p>
  <p>Database: <code>${escapeHtml(neon.databaseName)}</code> · AISplinter target: ${escapeHtml(result.target)}</p>
  <p><a href="${escapeHtml(redirectTo)}">Continue setup →</a></p>
</body></html>`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Neon setup failed';
        return c.html(
          `<html><body><h1>Neon setup failed</h1><pre>${escapeHtml(message)}</pre><p><a href="${normalizeBasePath(basePath) || '/'}">Back</a></p></body></html>`,
          500,
        );
      }
    });

    app.post('/setup/init', async (c) => {
      if (!databaseReady) {
        return c.json({ error: 'Configure database first' }, 400);
      }
      if (!c.get('isSetupMode')) {
        return c.json({ error: 'Setup already completed' }, 403);
      }

      const body = await c.req.json();
      const { name, upstreamAdapter, openrouterKey, litellmKey, litellmBaseUrl } = body;

      if (!name || !upstreamAdapter) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      try {
        const project = await createProject({
          name,
          upstreamAdapter,
          openrouterKey,
          litellmKey,
          litellmBaseUrl,
        });

        return c.json({
          message: 'Setup successful',
          apiKey: project.apiKey,
          projectId: project.id,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Setup failed';
        return c.json({ error: message }, 400);
      }
    });
  }

  // Admin UI + JSON API — always mounted (production embeds disable setupWizard HTML only).
  app.get('/admin', async (c) => {
    if (c.get('isSetupMode')) {
      const setupRoot = `${normalizeBasePath(basePath) || ''}/`;
      if (setupWizard) {
        return c.redirect(setupRoot);
      }
      return c.json({ error: 'AISplinter is not configured — set DATABASE_URL and upstream env vars.' }, 503);
    }
    const html = await serveAdminHtml();
    return c.html(html);
  });

  app.route('/admin', adminRoutes);

  app.route('/v1', proxy);
  app.route('/v1/users', userRoutes);
  app.route('/v1/plans', planRoutes);

  return { app, databaseReady, bootstrappedFromEnv };
}
