import { desc, eq, and } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { entitlements, usageLedger, users } from '../db/schema.js';
import { effectiveProjectConfig, getSingletonProjectRow } from './project.js';
import {
  buildUserOpenRouterKeyBundle,
  fetchAllOpenRouterManagementKeys,
  groupOpenRouterKeysByUserId,
  syncOpenRouterUserFromBundle,
  type AdminUpstreamKeyRow,
  type OpenRouterManagementKey,
} from './openrouter-sync.js';

export type { AdminUpstreamKeyRow };

export type AdminUserRow = {
  id: string;
  externalUserId: string;
  planSku: string | null;
  budgetUsdRemaining: number | null;
  budgetUsdTotal: number | null;
  period: string | null;
  hasUpstreamKey: boolean;
  upstreamKeyMasked: string | null;
  activeKeyHash: string | null;
  upstreamKeyCount: number;
  upstreamKeys: AdminUpstreamKeyRow[];
  /** All-time spend — combined across all OpenRouter keys for this user. */
  usageUsdTotal: number;
  /** Spend in current billing cycle (monthly/daily/weekly), combined. */
  usageUsdCycle: number;
  usageSource: 'openrouter' | 'proxy' | 'none';
  createdAt: string;
  metadata: unknown;
};

function maskKey(keyRef: string | null | undefined): string | null {
  const v = keyRef?.trim();
  if (!v) return null;
  if (v.length <= 12) return '••••••••';
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

type UserBudgetRow = {
  id: string;
  externalUserId: string;
  upstreamKeyRef: string | null;
  metadata: unknown;
  planSku: string | null;
  budgetUsdRemaining: number | null;
  budgetUsdTotal: number | null;
  period: string | null;
};

export type ProjectUserBudgetSnapshot = {
  budgetUsdRemaining: number | null;
  budgetUsdTotal: number | null;
  period: string | null;
  usageUsdTotal: number;
  usageUsdCycle: number;
  usageSource: AdminUserRow['usageSource'];
};

async function resolveUserBudgetSnapshot(
  row: UserBudgetRow,
  projectId: string,
  usageByUser: Map<string, number>,
  keysByUserId: Map<string, OpenRouterManagementKey[]>,
  useOpenRouterSync: boolean,
): Promise<ProjectUserBudgetSnapshot> {
  let budgetUsdRemaining = row.budgetUsdRemaining;
  let budgetUsdTotal = row.budgetUsdTotal;
  let usageUsdTotal = usageByUser.get(row.id) ?? 0;
  let usageUsdCycle = usageUsdTotal;
  let usageSource: AdminUserRow['usageSource'] = usageUsdTotal > 0 ? 'proxy' : 'none';

  if (useOpenRouterSync && row.upstreamKeyRef?.trim()) {
    const bundle = buildUserOpenRouterKeyBundle({
      userId: row.id,
      period: row.period,
      activeKeyRef: row.upstreamKeyRef,
      metadata: row.metadata,
      managementKeys: keysByUserId.get(row.id) ?? [],
    });
    const stats = await syncOpenRouterUserFromBundle(row.id, bundle);
    usageUsdTotal = stats.usageUsdTotal;
    usageUsdCycle = stats.usageUsdCycle;
    usageSource = 'openrouter';
    if (stats.budgetUsdRemaining != null) budgetUsdRemaining = stats.budgetUsdRemaining;
    if (stats.budgetUsdTotal != null) budgetUsdTotal = stats.budgetUsdTotal;
  }

  return {
    budgetUsdRemaining,
    budgetUsdTotal,
    period: row.period,
    usageUsdTotal,
    usageUsdCycle,
    usageSource,
  };
}

export async function listProjectUsers(): Promise<AdminUserRow[]> {
  const project = await getSingletonProjectRow();
  if (!project) return [];

  const rows = await getDb()
    .select({
      id: users.id,
      externalUserId: users.externalUserId,
      upstreamKeyRef: users.upstreamKeyRef,
      metadata: users.metadata,
      createdAt: users.createdAt,
      planSku: entitlements.planSku,
      budgetUsdRemaining: entitlements.budgetUsdRemaining,
      budgetUsdTotal: entitlements.budgetUsdTotal,
      period: entitlements.period,
    })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(eq(users.projectId, project.id))
    .orderBy(desc(users.createdAt));

  const usageByUser = new Map<string, number>();
  const usageRows = await getDb()
    .select({
      userId: usageLedger.userId,
      amountUsd: usageLedger.amountUsd,
    })
    .from(usageLedger)
    .where(eq(usageLedger.projectId, project.id));

  for (const u of usageRows) {
    usageByUser.set(u.userId, (usageByUser.get(u.userId) ?? 0) + (u.amountUsd ?? 0));
  }

  const projectConfig = effectiveProjectConfig(project.config);
  const useOpenRouterSync = projectConfig?.upstreamAdapter === 'openrouter';
  const managementKey = projectConfig?.openrouterKey?.trim() ?? '';

  let keysByUserId = new Map<string, OpenRouterManagementKey[]>();
  if (useOpenRouterSync && managementKey) {
    const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, 'monthly');
    keysByUserId = groupOpenRouterKeysByUserId(allKeys, project.id);
  }

  const mapped = await Promise.all(
    rows.map(async (r) => {
      let upstreamKeys: AdminUpstreamKeyRow[] = [];
      let activeKeyHash: string | null = null;

      if (useOpenRouterSync && r.upstreamKeyRef?.trim()) {
        const bundle = buildUserOpenRouterKeyBundle({
          userId: r.id,
          period: r.period,
          activeKeyRef: r.upstreamKeyRef,
          metadata: r.metadata,
          managementKeys: keysByUserId.get(r.id) ?? [],
        });
        upstreamKeys = bundle.keys;
        activeKeyHash = bundle.activeKeyHash;
      }

      const snapshot = await resolveUserBudgetSnapshot(
        r,
        project.id,
        usageByUser,
        keysByUserId,
        useOpenRouterSync,
      );

      return {
        id: r.id,
        externalUserId: r.externalUserId,
        planSku: r.planSku,
        budgetUsdRemaining: snapshot.budgetUsdRemaining,
        budgetUsdTotal: snapshot.budgetUsdTotal,
        period: snapshot.period,
        hasUpstreamKey: !!r.upstreamKeyRef?.trim(),
        upstreamKeyMasked: maskKey(r.upstreamKeyRef),
        activeKeyHash,
        upstreamKeyCount: upstreamKeys.length,
        upstreamKeys,
        usageUsdTotal: snapshot.usageUsdTotal,
        usageUsdCycle: snapshot.usageUsdCycle,
        usageSource: snapshot.usageSource,
        createdAt: r.createdAt.toISOString(),
        metadata: r.metadata,
      };
    }),
  );

  return mapped;
}

export async function getProjectUserByExternalId(
  externalUserId: string,
): Promise<AdminUserRow | null> {
  const normalized = externalUserId.trim();
  if (!normalized) return null;
  const list = await listProjectUsers();
  return list.find((u) => u.externalUserId === normalized) ?? null;
}

/** Sync one user's OpenRouter budget without loading the full admin user list. */
export async function refreshProjectUserBudgetByExternalId(
  externalUserId: string,
): Promise<ProjectUserBudgetSnapshot | null> {
  const normalized = externalUserId.trim();
  if (!normalized) return null;

  const project = await getSingletonProjectRow();
  if (!project) return null;

  const rows = await getDb()
    .select({
      id: users.id,
      externalUserId: users.externalUserId,
      upstreamKeyRef: users.upstreamKeyRef,
      metadata: users.metadata,
      planSku: entitlements.planSku,
      budgetUsdRemaining: entitlements.budgetUsdRemaining,
      budgetUsdTotal: entitlements.budgetUsdTotal,
      period: entitlements.period,
    })
    .from(users)
    .leftJoin(entitlements, eq(entitlements.userId, users.id))
    .where(and(eq(users.projectId, project.id), eq(users.externalUserId, normalized)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const usageRows = await getDb()
    .select({
      userId: usageLedger.userId,
      amountUsd: usageLedger.amountUsd,
    })
    .from(usageLedger)
    .where(eq(usageLedger.projectId, project.id));

  const usageByUser = new Map<string, number>();
  for (const u of usageRows) {
    usageByUser.set(u.userId, (usageByUser.get(u.userId) ?? 0) + (u.amountUsd ?? 0));
  }

  const projectConfig = effectiveProjectConfig(project.config);
  const useOpenRouterSync = projectConfig?.upstreamAdapter === 'openrouter';
  const managementKey = projectConfig?.openrouterKey?.trim() ?? '';

  let keysByUserId = new Map<string, OpenRouterManagementKey[]>();
  if (useOpenRouterSync && managementKey) {
    const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, row.period ?? 'monthly');
    keysByUserId = groupOpenRouterKeysByUserId(allKeys, project.id);
  }

  return resolveUserBudgetSnapshot(
    row,
    project.id,
    usageByUser,
    keysByUserId,
    useOpenRouterSync,
  );
}

export type AdminUsersSummary = {
  totalUsers: number;
  provisionedKeys: number;
  totalBudgetUsd: number;
  totalRemainingUsd: number;
};

export async function getProjectUsersSummary(): Promise<AdminUsersSummary> {
  const list = await listProjectUsers();
  return {
    totalUsers: list.length,
    provisionedKeys: list.filter((u) => u.hasUpstreamKey).length,
    totalBudgetUsd: list.reduce((s, u) => s + (u.budgetUsdTotal ?? 0), 0),
    totalRemainingUsd: list.reduce((s, u) => s + (u.budgetUsdRemaining ?? 0), 0),
  };
}

export type AisplinterUsageTotals = {
  total: number;
  cycle: number;
  ok: boolean;
};

/** Sum proxy ledger spend for one AISplinter user (internal UUID). */
export async function loadAisplinterUsageTotals(
  aisplinterUserId: string,
): Promise<AisplinterUsageTotals> {
  const id = aisplinterUserId.trim();
  if (!id) {
    return { total: 0, cycle: 0, ok: true };
  }

  const project = await getSingletonProjectRow();
  if (!project) {
    return { total: 0, cycle: 0, ok: false };
  }

  try {
    const usageRows = await getDb()
      .select({
        amountUsd: usageLedger.amountUsd,
        createdAt: usageLedger.createdAt,
      })
      .from(usageLedger)
      .where(and(eq(usageLedger.projectId, project.id), eq(usageLedger.userId, id)));

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    let total = 0;
    let cycle = 0;
    for (const row of usageRows) {
      const amount = row.amountUsd ?? 0;
      total += amount;
      if (row.createdAt >= monthStart) {
        cycle += amount;
      }
    }

    return { total, cycle, ok: true };
  } catch {
    return { total: 0, cycle: 0, ok: false };
  }
}

export type ReassignExternalIdResult =
  | { reassigned: true; aisplinterUserId: string; merged: boolean }
  | { reassigned: false; reason: string };

/**
 * Point AISplinter proxy user(s) at the canonical Egocentric Better Auth id.
 * When the target already has a row, donor rows are removed (merge).
 */
export async function reassignProjectUserExternalId(
  fromExternalId: string,
  toExternalId: string,
): Promise<ReassignExternalIdResult> {
  const from = fromExternalId.trim();
  const to = toExternalId.trim();
  if (!from || !to) {
    return { reassigned: false, reason: 'empty_id' };
  }
  if (from === to) {
    return { reassigned: true, aisplinterUserId: '', merged: false };
  }

  const project = await getSingletonProjectRow();
  if (!project) {
    return { reassigned: false, reason: 'no_project' };
  }

  const donor = await getDb().query.users.findFirst({
    where: and(eq(users.projectId, project.id), eq(users.externalUserId, from)),
  });
  if (!donor) {
    return { reassigned: false, reason: 'donor_not_found' };
  }

  const target = await getDb().query.users.findFirst({
    where: and(eq(users.projectId, project.id), eq(users.externalUserId, to)),
  });

  if (target && target.id !== donor.id) {
    await getDb().delete(usageLedger).where(eq(usageLedger.userId, donor.id));
    await getDb().delete(entitlements).where(eq(entitlements.userId, donor.id));
    await getDb().delete(users).where(eq(users.id, donor.id));
    return { reassigned: true, aisplinterUserId: target.id, merged: true };
  }

  await getDb()
    .update(users)
    .set({ externalUserId: to })
    .where(eq(users.id, donor.id));

  return { reassigned: true, aisplinterUserId: donor.id, merged: false };
}
