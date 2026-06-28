import { AisplinterClient, type AisplinterConfig } from './client.js';

export type { AisplinterConfig } from './client.js';
export { AisplinterClient, AisplinterError, isBudgetExhausted } from './client.js';

/** Default local AISplinter port (matches server). */
export const AISPLINTER_DEFAULT_PORT = 8747;

export const AISPLINTER_DEFAULT_BASE_URL = `http://127.0.0.1:${AISPLINTER_DEFAULT_PORT}`;

/** Standard env var names — use the same in any host app (.env, Docker, Vite, etc.). */
export const AISPLINTER_ENV = {
  BASE_URL: 'AISPLINTER_BASE_URL',
  URL: 'AISPLINTER_URL',
  DEV_KEY: 'AISPLINTER_DEV_KEY',
  SESSION_TOKEN: 'AISPLINTER_SESSION_TOKEN',
  PLAN_SKU: 'AISPLINTER_PLAN_SKU',
} as const;

export type EnvRecord = Record<string, string | undefined>;

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

/**
 * Build client config from environment variables.
 * Returns null when dev key / session token are missing.
 *
 * Server secrets (DATABASE_URL, OPENROUTER keys) stay in the AISplinter server `.env` only.
 */
export function loadConfigFromEnv(
  env: EnvRecord = defaultEnvRecord(),
): AisplinterConfig | null {
  const baseUrl =
    readEnv(env, AISPLINTER_ENV.BASE_URL) ??
    readEnv(env, AISPLINTER_ENV.URL) ??
    AISPLINTER_DEFAULT_BASE_URL;

  const devKey = readEnv(env, AISPLINTER_ENV.DEV_KEY);
  const sessionToken = readEnv(env, AISPLINTER_ENV.SESSION_TOKEN);

  if (!devKey && !sessionToken) {
    return null;
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    devKey,
    sessionToken,
  };
}

export function loadClientFromEnv(env?: EnvRecord): AisplinterClient | null {
  const config = loadConfigFromEnv(env);
  if (!config) return null;
  return new AisplinterClient(config);
}
