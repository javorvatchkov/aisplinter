import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { entitlements } from '../db/schema.js';
import { readUserOpenRouterMetadata } from './user-upstream-keys.js';

export type OpenRouterUserKeyStats = {
  usageUsdTotal: number;
  usageUsdCycle: number;
  budgetUsdTotal: number | null;
  budgetUsdRemaining: number | null;
  limitReset: string | null;
};

export type OpenRouterManagementKey = {
  hash: string;
  name: string;
  label: string;
  disabled: boolean;
  usageUsdTotal: number;
  usageUsdCycle: number;
  limitUsd: number | null;
  limitRemainingUsd: number | null;
  limitReset: string | null;
  createdAt: string | null;
};

export type AdminUpstreamKeyRow = {
  hash: string;
  name: string | null;
  label: string | null;
  isActive: boolean;
  isRetired: boolean;
  disabled: boolean;
  usageUsdTotal: number;
  usageUsdCycle: number;
  limitUsd: number | null;
  limitRemainingUsd: number | null;
  createdAt: string | null;
};

export type UserOpenRouterKeyBundle = {
  keys: AdminUpstreamKeyRow[];
  combined: OpenRouterUserKeyStats;
  activeKeyHash: string | null;
};

type OpenRouterKeyResponse = {
  data?: {
    limit?: number | null;
    limit_remaining?: number | null;
    limit_reset?: string | null;
    usage?: number;
    usage_daily?: number;
    usage_weekly?: number;
    usage_monthly?: number;
  };
};

type OpenRouterManagementKeyRaw = {
  hash?: string;
  name?: string;
  label?: string;
  disabled?: boolean;
  usage?: number;
  usage_daily?: number;
  usage_weekly?: number;
  usage_monthly?: number;
  limit?: number | null;
  limit_remaining?: number | null;
  limit_reset?: string | null;
  created_at?: string;
};

const AISPLINTER_KEY_NAME_RE =
  /^aisplinter-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

function cycleUsageForPeriod(
  data: { usage?: number; usage_daily?: number; usage_weekly?: number; usage_monthly?: number },
  period: string | null | undefined,
): number {
  const normalized = period?.trim().toLowerCase();
  if (normalized === 'daily') return Number(data.usage_daily ?? data.usage ?? 0);
  if (normalized === 'weekly') return Number(data.usage_weekly ?? data.usage ?? 0);
  return Number(data.usage_monthly ?? data.usage ?? 0);
}

function mapManagementKey(raw: OpenRouterManagementKeyRaw, period: string | null): OpenRouterManagementKey | null {
  const hash = raw.hash?.trim();
  if (!hash) return null;
  return {
    hash,
    name: typeof raw.name === 'string' ? raw.name : '',
    label: typeof raw.label === 'string' ? raw.label : '',
    disabled: raw.disabled === true,
    usageUsdTotal: Number(raw.usage ?? 0),
    usageUsdCycle: cycleUsageForPeriod(raw, period),
    limitUsd: raw.limit != null ? Number(raw.limit) : null,
    limitRemainingUsd: raw.limit_remaining != null ? Number(raw.limit_remaining) : null,
    limitReset: typeof raw.limit_reset === 'string' ? raw.limit_reset : null,
    createdAt: typeof raw.created_at === 'string' ? raw.created_at : null,
  };
}

export function parseAisplinterUserIdFromKeyName(
  name: string,
  projectId: string,
): string | null {
  const match = name.trim().match(AISPLINTER_KEY_NAME_RE);
  if (!match) return null;
  const keyProjectId = match[1]?.toLowerCase();
  const userId = match[2];
  if (!userId || keyProjectId !== projectId.trim().toLowerCase()) return null;
  return userId;
}

export function groupOpenRouterKeysByUserId(
  keys: OpenRouterManagementKey[],
  projectId: string,
): Map<string, OpenRouterManagementKey[]> {
  const grouped = new Map<string, OpenRouterManagementKey[]>();
  for (const key of keys) {
    const userId = parseAisplinterUserIdFromKeyName(key.name, projectId);
    if (!userId) continue;
    const list = grouped.get(userId) ?? [];
    list.push(key);
    grouped.set(userId, list);
  }
  for (const [userId, list] of grouped) {
    list.sort((a, b) => {
      const at = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bt - at;
    });
    grouped.set(userId, list);
  }
  return grouped;
}

/** Fetch a single provisioned key by management API hash. */
export async function fetchOpenRouterKeyByHash(
  managementKey: string,
  hash: string,
  period: string | null = 'monthly',
): Promise<OpenRouterManagementKey | null> {
  const trimmedKey = managementKey.trim();
  const trimmedHash = hash.trim();
  if (!trimmedKey || !trimmedHash) return null;

  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/keys/${encodeURIComponent(trimmedHash)}`,
      { headers: { Authorization: `Bearer ${trimmedKey}` } },
    );
    if (!res.ok) return null;

    const json = (await res.json().catch(() => ({}))) as { data?: OpenRouterManagementKeyRaw };
    if (!json.data) return null;
    return mapManagementKey(json.data, period);
  } catch {
    return null;
  }
}

/** Raise the OpenRouter spending cap for a provisioned key (management API hash). */
export async function patchOpenRouterKeyLimit(
  managementKey: string,
  hash: string,
  newLimitUsd: number,
): Promise<boolean> {
  const trimmedKey = managementKey.trim();
  const trimmedHash = hash.trim();
  if (!trimmedKey || !trimmedHash || !Number.isFinite(newLimitUsd) || newLimitUsd <= 0) {
    return false;
  }

  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/keys/${encodeURIComponent(trimmedHash)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${trimmedKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: newLimitUsd }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchAllOpenRouterManagementKeys(
  managementKey: string,
  period: string | null = 'monthly',
): Promise<OpenRouterManagementKey[]> {
  const trimmed = managementKey.trim();
  if (!trimmed) return [];

  try {
    const res = await fetch('https://openrouter.ai/api/v1/keys', {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (!res.ok) return [];

    const json = (await res.json().catch(() => ({}))) as { data?: OpenRouterManagementKeyRaw[] };
    const rows = Array.isArray(json.data) ? json.data : [];
    return rows
      .map((row) => mapManagementKey(row, period))
      .filter((row): row is OpenRouterManagementKey => row != null);
  } catch {
    return [];
  }
}

function labelMatchesKeyRef(label: string | null | undefined, keyRef: string | null | undefined): boolean {
  const ref = keyRef?.trim();
  const lab = label?.trim();
  if (!ref || !lab) return false;
  return lab.includes(ref.slice(-4)) && lab.includes(ref.slice(0, 8).slice(-6));
}

function isActiveKey(
  key: OpenRouterManagementKey,
  activeKeyRef: string | null | undefined,
  activeKeyHash: string | null | undefined,
): boolean {
  if (activeKeyHash && key.hash === activeKeyHash) return true;
  return labelMatchesKeyRef(key.label, activeKeyRef);
}

export function buildUserOpenRouterKeyBundle(input: {
  userId: string;
  period: string | null;
  activeKeyRef: string | null | undefined;
  metadata: unknown;
  managementKeys: OpenRouterManagementKey[];
}): UserOpenRouterKeyBundle {
  const orMeta = readUserOpenRouterMetadata(input.metadata);
  const retiredHashes = new Set(
    (orMeta.keyHistory ?? []).map((h) => h.hash?.trim()).filter((h): h is string => !!h),
  );

  const keys: AdminUpstreamKeyRow[] = input.managementKeys.map((key) => {
    const active = isActiveKey(key, input.activeKeyRef, orMeta.activeKeyHash);
    const retired = !active && (retiredHashes.has(key.hash) || input.managementKeys.length > 1);
    return {
      hash: key.hash,
      name: key.name || null,
      label: key.label || null,
      isActive: active,
      isRetired: retired && !active,
      disabled: key.disabled,
      usageUsdTotal: key.usageUsdTotal,
      usageUsdCycle: key.usageUsdCycle,
      limitUsd: key.limitUsd,
      limitRemainingUsd: key.limitRemainingUsd,
      createdAt: key.createdAt,
    };
  });

  if (!keys.length && input.activeKeyRef?.trim()) {
    keys.push({
      hash: orMeta.activeKeyHash ?? 'unknown',
      name: null,
      label: `${input.activeKeyRef.slice(0, 8)}…${input.activeKeyRef.slice(-4)}`,
      isActive: true,
      isRetired: false,
      disabled: false,
      usageUsdTotal: 0,
      usageUsdCycle: 0,
      limitUsd: null,
      limitRemainingUsd: null,
      createdAt: null,
    });
  }

  const activeKey = keys.find((k) => k.isActive) ?? keys[0] ?? null;
  const combined: OpenRouterUserKeyStats = {
    usageUsdTotal: keys.reduce((s, k) => s + k.usageUsdTotal, 0),
    usageUsdCycle: keys.reduce((s, k) => s + k.usageUsdCycle, 0),
    budgetUsdTotal: activeKey?.limitUsd ?? null,
    budgetUsdRemaining: activeKey?.limitRemainingUsd ?? null,
    limitReset: null,
  };

  return {
    keys,
    combined,
    activeKeyHash: activeKey?.hash ?? orMeta.activeKeyHash ?? null,
  };
}

/** Live stats for a scoped OpenRouter key (client-direct or proxy). */
export async function fetchOpenRouterKeyStats(
  apiKey: string,
  period?: string | null,
): Promise<OpenRouterUserKeyStats | null> {
  const trimmed = apiKey.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${trimmed}` },
    });
    if (!res.ok) return null;

    const json = (await res.json().catch(() => ({}))) as OpenRouterKeyResponse;
    const data = json.data;
    if (!data) return null;

    return {
      usageUsdTotal: Number(data.usage ?? 0),
      usageUsdCycle: cycleUsageForPeriod(data, period),
      budgetUsdTotal: data.limit != null ? Number(data.limit) : null,
      budgetUsdRemaining: data.limit_remaining != null ? Number(data.limit_remaining) : null,
      limitReset: typeof data.limit_reset === 'string' ? data.limit_reset : null,
    };
  } catch {
    return null;
  }
}

/** Pull OpenRouter spend/limits into AISplinter entitlements (active key budgets). */
export async function syncOpenRouterUserEntitlement(
  userId: string,
  stats: OpenRouterUserKeyStats,
): Promise<void> {
  const patch: {
    budgetUsdRemaining?: number;
    budgetUsdTotal?: number;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (stats.budgetUsdRemaining != null) {
    patch.budgetUsdRemaining = stats.budgetUsdRemaining;
  }
  if (stats.budgetUsdTotal != null) {
    patch.budgetUsdTotal = stats.budgetUsdTotal;
  }

  if (patch.budgetUsdRemaining != null || patch.budgetUsdTotal != null) {
    await getDb().update(entitlements).set(patch).where(eq(entitlements.userId, userId));
  }
}

export async function syncOpenRouterUserFromBundle(
  userId: string,
  bundle: UserOpenRouterKeyBundle,
): Promise<OpenRouterUserKeyStats> {
  await syncOpenRouterUserEntitlement(userId, bundle.combined);
  return bundle.combined;
}

export type OpenRouterKeyRevokeResult = {
  keysDeleted: number;
  keysFailed: number;
};

/** Delete one provisioned key via OpenRouter management API (hash from list/provision). */
export async function deleteOpenRouterKeyByHash(
  managementKey: string,
  hash: string,
): Promise<boolean> {
  const trimmedKey = managementKey.trim();
  const trimmedHash = hash.trim();
  if (!trimmedKey || !trimmedHash) return false;

  try {
    const res = await fetch(
      `https://openrouter.ai/api/v1/keys/${encodeURIComponent(trimmedHash)}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${trimmedKey}` },
      },
    );
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

function collectKeyHashesForAisplinterUser(input: {
  aisplinterUserId: string;
  metadata: unknown;
  upstreamKeyRef: string | null | undefined;
  managementKeys: OpenRouterManagementKey[];
}): Set<string> {
  const hashes = new Set<string>();
  for (const key of input.managementKeys) {
    hashes.add(key.hash);
  }
  const orMeta = readUserOpenRouterMetadata(input.metadata);
  if (orMeta.activeKeyHash?.trim()) {
    hashes.add(orMeta.activeKeyHash.trim());
  }
  for (const entry of orMeta.keyHistory ?? []) {
    if (entry.hash?.trim()) hashes.add(entry.hash.trim());
  }
  // Match active scoped key by label when hash was not persisted.
  if (input.upstreamKeyRef?.trim()) {
    for (const key of input.managementKeys) {
      if (labelMatchesKeyRef(key.label, input.upstreamKeyRef)) {
        hashes.add(key.hash);
      }
    }
  }
  return hashes;
}

/** Revoke all OpenRouter keys for AISplinter users (active + retired duplicates). */
export async function revokeOpenRouterKeysForAisplinterUsers(
  managementKey: string,
  projectId: string,
  users: {
    id: string;
    metadata: unknown;
    upstreamKeyRef: string | null;
  }[],
): Promise<OpenRouterKeyRevokeResult> {
  if (!managementKey.trim() || users.length === 0) {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  const allKeys = await fetchAllOpenRouterManagementKeys(managementKey);
  const grouped = groupOpenRouterKeysByUserId(allKeys, projectId);

  const hashesToDelete = new Set<string>();
  for (const user of users) {
    for (const hash of collectKeyHashesForAisplinterUser({
      aisplinterUserId: user.id,
      metadata: user.metadata,
      upstreamKeyRef: user.upstreamKeyRef,
      managementKeys: grouped.get(user.id) ?? [],
    })) {
      hashesToDelete.add(hash);
    }
  }

  let keysDeleted = 0;
  let keysFailed = 0;
  await Promise.all(
    [...hashesToDelete].map(async (hash) => {
      const ok = await deleteOpenRouterKeyByHash(managementKey, hash);
      if (ok) keysDeleted += 1;
      else keysFailed += 1;
    }),
  );

  return { keysDeleted, keysFailed };
}
