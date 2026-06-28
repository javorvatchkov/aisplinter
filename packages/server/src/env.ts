import type { UpstreamAdapterId } from './adapters/types.js';

export type EnvRecord = Record<string, string | undefined>;

export const AISPLINTER_SERVER_ENV = {
  DATABASE_URL: 'DATABASE_URL',
  DB_SCHEMA: 'AISPLINTER_DB_SCHEMA',
  DATA_DIR: 'AISPLINTER_DATA_DIR',
  PROJECT_NAME: 'AISPLINTER_PROJECT_NAME',
  UPSTREAM_ADAPTER: 'AISPLINTER_UPSTREAM_ADAPTER',
  OPENROUTER_KEY: 'AISPLINTER_OPENROUTER_KEY',
  LITELLM_KEY: 'AISPLINTER_LITELLM_KEY',
  LITELLM_BASE_URL: 'AISPLINTER_LITELLM_BASE_URL',
  DEV_KEY: 'AISPLINTER_DEV_KEY',
  JWT_SECRET: 'JWT_SECRET',
  PORT: 'PORT',
} as const;

export interface ServerProjectConfig {
  name: string;
  upstreamAdapter: UpstreamAdapterId;
  openrouterKey?: string;
  litellmKey?: string;
  litellmBaseUrl?: string;
  devKey?: string;
}

export interface AisplinterServerConfig {
  databaseUrl?: string;
  dbSchema?: string;
  dataDir?: string;
  jwtSecret?: string;
  project?: ServerProjectConfig | null;
}

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

function readEnv(env: EnvRecord, key: string): string | undefined {
  return trim(env[key]);
}

function defaultEnvRecord(): EnvRecord {
  if (typeof process !== 'undefined' && process.env) {
    return process.env as EnvRecord;
  }
  return {};
}

function parseProjectConfig(env: EnvRecord): ServerProjectConfig | null {
  const name = readEnv(env, AISPLINTER_SERVER_ENV.PROJECT_NAME) ?? 'default';
  const adapterRaw =
    readEnv(env, AISPLINTER_SERVER_ENV.UPSTREAM_ADAPTER)?.toLowerCase() ?? 'openrouter';

  if (adapterRaw !== 'openrouter' && adapterRaw !== 'litellm') {
    return null;
  }

  const upstreamAdapter = adapterRaw as UpstreamAdapterId;
  const openrouterKey =
    readEnv(env, AISPLINTER_SERVER_ENV.OPENROUTER_KEY) ??
    readEnv(env, 'OPENROUTER_API_KEY');
  const litellmKey =
    readEnv(env, AISPLINTER_SERVER_ENV.LITELLM_KEY) ??
    readEnv(env, 'LITELLM_MASTER_KEY');
  const litellmBaseUrl =
    readEnv(env, AISPLINTER_SERVER_ENV.LITELLM_BASE_URL) ??
    readEnv(env, 'LITELLM_BASE_URL');
  const devKey = readEnv(env, AISPLINTER_SERVER_ENV.DEV_KEY);

  if (upstreamAdapter === 'openrouter' && !openrouterKey) {
    return null;
  }
  if (upstreamAdapter === 'litellm' && (!litellmKey || !litellmBaseUrl)) {
    return null;
  }

  return {
    name,
    upstreamAdapter,
    openrouterKey,
    litellmKey,
    litellmBaseUrl,
    devKey,
  };
}

/**
 * Load server-side config from environment variables.
 * Works in any host: standalone Node, Next.js, Docker, etc.
 */
export function loadServerConfigFromEnv(
  env: EnvRecord = defaultEnvRecord(),
): AisplinterServerConfig {
  const databaseUrl = readEnv(env, AISPLINTER_SERVER_ENV.DATABASE_URL);
  const project = parseProjectConfig(env);

  return {
    databaseUrl,
    dbSchema: readEnv(env, AISPLINTER_SERVER_ENV.DB_SCHEMA),
    dataDir: readEnv(env, AISPLINTER_SERVER_ENV.DATA_DIR),
    jwtSecret: readEnv(env, AISPLINTER_SERVER_ENV.JWT_SECRET),
    project,
  };
}

export function canBootstrapFromServerConfig(config: AisplinterServerConfig): boolean {
  return !!config.databaseUrl?.trim() && config.project !== null;
}

export function getDefaultPort(env: EnvRecord = defaultEnvRecord()): number {
  const raw = readEnv(env, AISPLINTER_SERVER_ENV.PORT);
  if (!raw) return 8747;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 8747;
}
