import { count, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { projects, users } from '../db/schema.js';
import { generateDevKey } from '../utils/keys.js';
import {
  mergeProjectConfigWithEnv,
  validateUpstreamConfig,
  type EnvProjectConfig,
  type StoredProjectConfig,
} from '../bootstrap/envSetup.js';
import type { UpstreamAdapterId } from '../adapters/types.js';

type ProjectConfig = StoredProjectConfig;

export type MaskedSecret = {
  configured: boolean;
  masked: string | null;
};

export type AisplinterProjectAdminView = {
  id: string;
  name: string;
  apiKey: string;
  upstreamAdapter: UpstreamAdapterId | null;
  upstreamReady: boolean;
  openrouterKey: MaskedSecret;
  litellmKey: MaskedSecret;
  litellmBaseUrl: string | null;
  userCount: number;
  createdAt: string;
  envDevKeyMatches: boolean;
};

export type UpstreamUpdateInput = {
  name?: string;
  upstreamAdapter: UpstreamAdapterId;
  openrouterKey?: string;
  litellmKey?: string;
  litellmBaseUrl?: string;
};

function maskSecret(value?: string): MaskedSecret {
  const v = value?.trim();
  if (!v) return { configured: false, masked: null };
  if (v.length <= 10) return { configured: true, masked: '••••••••' };
  return { configured: true, masked: `${v.slice(0, 8)}…${v.slice(-4)}` };
}

function parseConfig(raw: unknown): ProjectConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as ProjectConfig;
  if (c.upstreamAdapter !== 'openrouter' && c.upstreamAdapter !== 'litellm') {
    return null;
  }
  return mergeProjectConfigWithEnv(c);
}

export function effectiveProjectConfig(raw: unknown): ProjectConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const stored = raw as ProjectConfig;
  if (stored.upstreamAdapter !== 'openrouter' && stored.upstreamAdapter !== 'litellm') {
    return null;
  }
  return mergeProjectConfigWithEnv(stored) as ProjectConfig | null;
}

function isUpstreamReady(config: ProjectConfig | null): boolean {
  if (!config) return false;
  if (config.upstreamAdapter === 'openrouter') {
    return !!config.openrouterKey?.trim();
  }
  return !!(config.litellmKey?.trim() && config.litellmBaseUrl?.trim());
}

/** One AISplinter install = one project (this codebase). */
export async function getSingletonProjectRow() {
  return getDb().query.projects.findFirst({
    orderBy: (p, { asc: a }) => [a(p.createdAt)],
  });
}

async function userCountFor(projectId: string): Promise<number> {
  const rows = await getDb()
    .select({ value: count() })
    .from(users)
    .where(eq(users.projectId, projectId));
  return rows[0]?.value ?? 0;
}

async function rowToAdminView(row: typeof projects.$inferSelect): Promise<AisplinterProjectAdminView> {
  const config = parseConfig(row.config);
  const envKey = process.env.AISPLINTER_DEV_KEY?.trim();

  return {
    id: row.id,
    name: row.name,
    apiKey: row.apiKey,
    upstreamAdapter: config?.upstreamAdapter ?? null,
    upstreamReady: isUpstreamReady(config),
    openrouterKey: maskSecret(config?.openrouterKey),
    litellmKey: maskSecret(config?.litellmKey),
    litellmBaseUrl: config?.litellmBaseUrl?.trim() || null,
    userCount: await userCountFor(row.id),
    createdAt: row.createdAt.toISOString(),
    envDevKeyMatches: !!envKey && envKey === row.apiKey,
  };
}

export async function getProjectAdminView(): Promise<AisplinterProjectAdminView | null> {
  const row = await getSingletonProjectRow();
  if (!row) return null;
  return rowToAdminView(row);
}

function toEnvConfig(
  name: string,
  upstreamAdapter: UpstreamAdapterId,
  keys: {
    openrouterKey?: string;
    litellmKey?: string;
    litellmBaseUrl?: string;
  },
): EnvProjectConfig {
  return {
    name,
    upstreamAdapter,
    openrouterKey: keys.openrouterKey,
    litellmKey: keys.litellmKey,
    litellmBaseUrl: keys.litellmBaseUrl,
  };
}

export async function testProjectUpstream(): Promise<{ ok: boolean; message: string }> {
  const row = await getSingletonProjectRow();
  if (!row) {
    return { ok: false, message: 'No AISplinter project found. Run setup first.' };
  }

  const config = parseConfig(row.config);
  if (!isUpstreamReady(config)) {
    return { ok: false, message: 'Configure an upstream provider first.' };
  }

  try {
    await validateUpstreamConfig({
      name: row.name,
      upstreamAdapter: config!.upstreamAdapter,
      openrouterKey: config!.openrouterKey,
      litellmKey: config!.litellmKey,
      litellmBaseUrl: config!.litellmBaseUrl,
    });
    if (config!.upstreamAdapter === 'openrouter') {
      return { ok: true, message: 'OpenRouter management key is valid.' };
    }
    return { ok: true, message: 'LiteLLM settings saved (connection verified on first request).' };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upstream test failed';
    return { ok: false, message };
  }
}

export async function updateProjectUpstream(
  input: UpstreamUpdateInput,
): Promise<AisplinterProjectAdminView> {
  const row = await getSingletonProjectRow();
  if (!row) {
    throw new Error('No AISplinter project found. Run setup first.');
  }

  const existing = parseConfig(row.config) ?? {
    upstreamAdapter: input.upstreamAdapter,
  };

  const nextConfig: ProjectConfig = {
    upstreamAdapter: input.upstreamAdapter,
    openrouterKey:
      input.openrouterKey?.trim() ||
      (input.upstreamAdapter === 'openrouter' ? existing.openrouterKey : undefined),
    litellmKey:
      input.litellmKey?.trim() ||
      (input.upstreamAdapter === 'litellm' ? existing.litellmKey : undefined),
    litellmBaseUrl:
      input.litellmBaseUrl?.trim() ||
      (input.upstreamAdapter === 'litellm' ? existing.litellmBaseUrl : undefined),
  };

  if (input.upstreamAdapter === 'openrouter' && !nextConfig.openrouterKey?.trim()) {
    throw new Error('OpenRouter management key is required.');
  }
  if (
    input.upstreamAdapter === 'litellm' &&
    (!nextConfig.litellmKey?.trim() || !nextConfig.litellmBaseUrl?.trim())
  ) {
    throw new Error('LiteLLM master key and base URL are required.');
  }

  await validateUpstreamConfig(
    toEnvConfig(input.name?.trim() || row.name, nextConfig.upstreamAdapter, nextConfig),
  );

  const name = input.name?.trim() || row.name;
  await getDb()
    .update(projects)
    .set({
      name,
      config: nextConfig,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, row.id));

  const view = await getProjectAdminView();
  if (!view) {
    throw new Error('Project missing after update.');
  }
  return view;
}

/** Persist env upstream secrets into `projects.config` when they differ (e.g. after Railway env update). */
export async function syncProjectUpstreamFromEnv(): Promise<boolean> {
  const row = await getSingletonProjectRow();
  if (!row) return false;

  const stored = (row.config ?? null) as ProjectConfig | null;
  const merged = mergeProjectConfigWithEnv(stored);
  if (!merged || !isUpstreamReady(merged)) return false;

  const unchanged =
    stored?.upstreamAdapter === merged.upstreamAdapter &&
    stored?.openrouterKey?.trim() === merged.openrouterKey?.trim() &&
    stored?.litellmKey?.trim() === merged.litellmKey?.trim() &&
    stored?.litellmBaseUrl?.trim() === merged.litellmBaseUrl?.trim();
  if (unchanged) return false;

  await getDb()
    .update(projects)
    .set({ config: merged, updatedAt: new Date() })
    .where(eq(projects.id, row.id));
  return true;
}

export async function regenerateProjectDevKey(): Promise<AisplinterProjectAdminView> {
  const existing = await getSingletonProjectRow();
  if (!existing) {
    throw new Error('No AISplinter project found.');
  }

  const apiKey = generateDevKey();
  await getDb()
    .update(projects)
    .set({ apiKey, updatedAt: new Date() })
    .where(eq(projects.id, existing.id));

  const view = await getProjectAdminView();
  if (!view) {
    throw new Error('Project missing after key rotation.');
  }
  return view;
}
