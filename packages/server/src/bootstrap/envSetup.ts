import { generateDevKey } from '../utils/keys.js';
import type { UpstreamAdapterId } from '../adapters/types.js';

export interface EnvProjectConfig {
  name: string;
  upstreamAdapter: UpstreamAdapterId;
  openrouterKey?: string;
  litellmKey?: string;
  litellmBaseUrl?: string;
  devKey?: string;
}

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

export function getEnvProjectConfig(): EnvProjectConfig | null {
  const name = trim(process.env.AISPLINTER_PROJECT_NAME) ?? 'default';
  const adapterRaw =
    trim(process.env.AISPLINTER_UPSTREAM_ADAPTER)?.toLowerCase() ?? 'openrouter';

  if (adapterRaw !== 'openrouter' && adapterRaw !== 'litellm') {
    return null;
  }

  const upstreamAdapter = adapterRaw as UpstreamAdapterId;
  const openrouterKey =
    trim(process.env.AISPLINTER_OPENROUTER_KEY) ??
    trim(process.env.OPENROUTER_API_KEY);
  const litellmKey =
    trim(process.env.AISPLINTER_LITELLM_KEY) ??
    trim(process.env.LITELLM_MASTER_KEY);
  const litellmBaseUrl =
    trim(process.env.AISPLINTER_LITELLM_BASE_URL) ??
    trim(process.env.LITELLM_BASE_URL);
  const devKey = trim(process.env.AISPLINTER_DEV_KEY);

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

/** True when .env has enough to create the first project without the setup UI. */
export function canBootstrapFromEnv(): boolean {
  return getDatabaseUrlFromEnv() !== undefined && getEnvProjectConfig() !== null;
}

export function getDatabaseUrlFromEnv(): string | undefined {
  return trim(process.env.DATABASE_URL);
}

export function resolveDevKey(config: EnvProjectConfig): string {
  return config.devKey ?? generateDevKey();
}

export async function validateUpstreamConfig(config: EnvProjectConfig): Promise<void> {
  if (config.upstreamAdapter === 'openrouter') {
    const key = config.openrouterKey!;
    // Provisioning uses the management/credits API — not the inference-only /auth/key check.
    const testResp = await fetch('https://openrouter.ai/api/v1/credits', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!testResp.ok) {
      const body = await testResp.text().catch(() => '');
      const lower = body.toLowerCase();
      if (lower.includes('invalid management key') || testResp.status === 401) {
        throw new Error(
          'Invalid OpenRouter management key (AISPLINTER_OPENROUTER_KEY). Create a provisioning key at openrouter.ai/keys — a regular inference key cannot mint user keys.',
        );
      }
      throw new Error('Invalid OpenRouter management key (AISPLINTER_OPENROUTER_KEY)');
    }
  }
  // LiteLLM: skip remote validation in file-first path; adapter will fail on first request if wrong
}

export type StoredProjectConfig = {
  upstreamAdapter: UpstreamAdapterId;
  openrouterKey?: string;
  litellmKey?: string;
  litellmBaseUrl?: string;
  minting?: Record<string, unknown>;
};

/** Prefer fresh Railway/.env secrets over keys snapshotted in `projects.config` at bootstrap time. */
export function mergeProjectConfigWithEnv(stored: StoredProjectConfig | null): StoredProjectConfig | null {
  if (!stored) return null;
  const env = getEnvProjectConfig();
  if (!env) return stored;

  return {
    ...stored,
    upstreamAdapter: stored.upstreamAdapter,
    openrouterKey: env.openrouterKey ?? stored.openrouterKey,
    litellmKey: env.litellmKey ?? stored.litellmKey,
    litellmBaseUrl: env.litellmBaseUrl ?? stored.litellmBaseUrl,
  };
}
