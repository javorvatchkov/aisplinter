import { getProjectUsersSummary, listProjectUsers } from './users.js';
import { getSingletonProjectRow } from './project.js';
import { effectiveProjectConfig } from './project.js';
import { getMintingFromConfig } from './minting.js';
import { sumResellerProfitUsd } from '../utils/resellerLedger.js';

export type OpenRouterCreditsView = {
  totalPurchasedUsd: number;
  totalUsedUsd: number;
  remainingUsd: number;
};

export type AdminOverviewStats = {
  projectName: string;
  createdAt: string | null;
  aisplinter: {
    totalUsers: number;
    provisionedKeys: number;
    budgetAllocatedUsd: number;
    budgetRemainingUsd: number;
    proxyUsageUsd: number;
    openRouterDirectUsageUsd: number;
    resellerMarginPercent: number;
    resellerProfitUsd: number;
  };
  openRouter: OpenRouterCreditsView | null;
  openRouterError: string | null;
};

function parseProjectConfig(raw: unknown): { openrouterKey?: string } | null {
  const c = effectiveProjectConfig(raw);
  if (!c || c.upstreamAdapter !== 'openrouter') return null;
  return c;
}

export async function fetchOpenRouterCredits(
  managementKey: string,
): Promise<OpenRouterCreditsView> {
  const res = await fetch('https://openrouter.ai/api/v1/credits', {
    headers: { Authorization: `Bearer ${managementKey.trim()}` },
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { total_credits?: number; total_usage?: number };
    error?: { message?: string };
  };
  if (!res.ok) {
    const msg = data.error?.message ?? `OpenRouter credits API failed (${res.status})`;
    throw new Error(msg);
  }
  const purchased = Number(data.data?.total_credits ?? 0);
  const used = Number(data.data?.total_usage ?? 0);
  return {
    totalPurchasedUsd: purchased,
    totalUsedUsd: used,
    remainingUsd: Math.max(0, purchased - used),
  };
}

export async function getAdminOverviewStats(): Promise<AdminOverviewStats | null> {
  const row = await getSingletonProjectRow();
  if (!row) return null;

  const summary = await getProjectUsersSummary();
  const users = await listProjectUsers();
  const proxyUsageUsd = users
    .filter((u) => u.usageSource === 'proxy')
    .reduce((s, u) => s + (u.usageUsdTotal ?? 0), 0);
  const openRouterDirectUsageUsd = users
    .filter((u) => u.usageSource === 'openrouter')
    .reduce((s, u) => s + (u.usageUsdCycle ?? 0), 0);

  let openRouter: OpenRouterCreditsView | null = null;
  let openRouterError: string | null = null;
  const config = parseProjectConfig(row.config);
  const fullConfig = effectiveProjectConfig(row.config);
  const minting = getMintingFromConfig(fullConfig);
  const resellerProfitUsd = await sumResellerProfitUsd(row.id);
  const managementKey = config?.openrouterKey?.trim();
  if (managementKey) {
    try {
      openRouter = await fetchOpenRouterCredits(managementKey);
    } catch (e: unknown) {
      openRouterError = e instanceof Error ? e.message : 'Could not load OpenRouter credits';
    }
  } else {
    openRouterError = 'OpenRouter management key not configured';
  }

  return {
    projectName: row.name,
    createdAt: row.createdAt.toISOString(),
    aisplinter: {
      totalUsers: summary.totalUsers,
      provisionedKeys: summary.provisionedKeys,
      budgetAllocatedUsd: summary.totalBudgetUsd,
      budgetRemainingUsd: summary.totalRemainingUsd,
      proxyUsageUsd,
      openRouterDirectUsageUsd,
      resellerMarginPercent: minting.resellerMarginPercent,
      resellerProfitUsd,
    },
    openRouter,
    openRouterError,
  };
}
