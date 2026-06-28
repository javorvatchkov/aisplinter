import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users, entitlements } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAdapter } from '../adapters/index.js';
import { createSessionToken } from '../utils/auth.js';
import { getMintingFromConfig, type MintingConfig } from '../admin/minting.js';
import { effectiveProjectConfig } from '../admin/project.js';
import {
  buildUserOpenRouterKeyBundle,
  fetchAllOpenRouterManagementKeys,
  fetchOpenRouterKeyByHash,
  fetchOpenRouterKeyStats,
  groupOpenRouterKeysByUserId,
  patchOpenRouterKeyLimit,
  syncOpenRouterUserFromBundle,
} from '../admin/openrouter-sync.js';
import { metadataForNewUpstreamKey, readUserOpenRouterMetadata } from '../admin/user-upstream-keys.js';
import { resolvePlanForProvision } from '../plans/index.js';
import { buildProviderDisclosure, getProviderInfo } from '../utils/providerInfo.js';
import { splitBudgetByResellerMargin } from '../utils/resellerMargin.js';
import { recordResellerProfit } from '../utils/resellerLedger.js';
import type { AppVariables } from '../types.js';

const userRoutes = new Hono<{ Variables: AppVariables }>();

userRoutes.use('/*', authMiddleware);

userRoutes.post('/provision', async (c) => {
  const project = c.get('project');
  if (!project) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  if (c.get('session')) {
    return c.json({ error: 'Provision requires developer API key' }, 403);
  }
  const body = await c.req.json();
  const { external_user_id, plan_sku, metadata, renew } = body;

  if (!external_user_id || !plan_sku) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const config = effectiveProjectConfig(project.config);
  if (!config) {
    return c.json({ error: 'Project upstream is not configured' }, 503);
  }
  const minting = getMintingFromConfig(config);

  let plan;
  try {
    plan = resolvePlanForProvision(config, plan_sku);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid plan';
    return c.json({ error: message }, 400);
  }

  const budgetSplit = splitBudgetByResellerMargin(plan.budgetUsd, minting.resellerMarginPercent);
  const userBudgetUsd = budgetSplit.userBudgetUsd;

  let user = await db.query.users.findFirst({
    where: and(eq(users.projectId, project.id), eq(users.externalUserId, external_user_id)),
  });

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({
        projectId: project.id,
        externalUserId: external_user_id,
        metadata,
      })
      .returning();
    user = newUser;
  }

  const adapter = getAdapter(config.upstreamAdapter, config);

  const forceNewKey = body.force_new_key === true;
  const hasExistingKey = !!user.upstreamKeyRef?.trim();
  // Reuse the scoped key unless this is an explicit first mint or forced rotation.
  const reuseExistingKey =
    hasExistingKey && (renew === true || (!forceNewKey && renew !== false));

  let provisionResult: { keyRef: string; upstreamKeyId?: string };

  if (reuseExistingKey) {
    provisionResult = { keyRef: user.upstreamKeyRef!.trim() };
  } else {
    try {
      provisionResult = await adapter.provisionUserKey({
        projectId: project.id,
        aisplinterUserId: user.id,
        externalUserId: user.externalUserId,
        planSku: plan.sku,
        budgetUsd: userBudgetUsd,
        period: plan.period,
        allowedModels: Object.values(plan.modelAliases),
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upstream key provision failed';
      return c.json({ error: message }, 502);
    }

    await db
      .update(users)
      .set({
        upstreamKeyRef: provisionResult.keyRef,
        metadata: metadataForNewUpstreamKey(
          metadata ?? user.metadata,
          user.upstreamKeyRef,
          provisionResult.keyRef,
          provisionResult.upstreamKeyId,
        ),
      })
      .where(eq(users.id, user.id));
  }

  const existingEnt = await db.query.entitlements.findFirst({
    where: eq(entitlements.userId, user.id),
  });

  if (existingEnt) {
    if (!reuseExistingKey) {
      await db
        .update(entitlements)
        .set({
          planSku: plan.sku,
          budgetUsdRemaining: userBudgetUsd,
          budgetUsdTotal: userBudgetUsd,
          period: plan.period,
          updatedAt: new Date(),
        })
        .where(eq(entitlements.userId, user.id));
      await recordResellerProfit(user.id, project.id, budgetSplit, {
        kind: 'provision',
        planSku: plan.sku,
      });
    }
  } else {
    await db.insert(entitlements).values({
      userId: user.id,
      projectId: project.id,
      planSku: plan.sku,
      budgetUsdRemaining: userBudgetUsd,
      budgetUsdTotal: userBudgetUsd,
      period: plan.period,
    });
    await recordResellerProfit(user.id, project.id, budgetSplit, {
      kind: 'provision',
      planSku: plan.sku,
    });
  }

  let responseBudgetRemaining = userBudgetUsd;
  let responseBudgetTotal = userBudgetUsd;
  let responsePeriod = plan.period;

  if (
    reuseExistingKey &&
    config.upstreamAdapter === 'openrouter' &&
    user.upstreamKeyRef?.trim() &&
    existingEnt
  ) {
    const managementKey = config.openrouterKey?.trim() ?? '';
    let stats = null;
    if (managementKey) {
      const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, existingEnt.period);
      const grouped = groupOpenRouterKeysByUserId(allKeys, project.id);
      const bundle = buildUserOpenRouterKeyBundle({
        userId: user.id,
        period: existingEnt.period,
        activeKeyRef: user.upstreamKeyRef,
        metadata: user.metadata,
        managementKeys: grouped.get(user.id) ?? [],
      });
      stats = await syncOpenRouterUserFromBundle(user.id, bundle);
    } else {
      stats = await fetchOpenRouterKeyStats(user.upstreamKeyRef, existingEnt.period);
      if (stats) {
        await syncOpenRouterUserFromBundle(user.id, {
          keys: [],
          combined: stats,
          activeKeyHash: null,
        });
      }
    }
    if (stats) {
      responseBudgetRemaining =
        stats.budgetUsdRemaining ?? existingEnt.budgetUsdRemaining ?? userBudgetUsd;
      responseBudgetTotal = stats.budgetUsdTotal ?? existingEnt.budgetUsdTotal ?? userBudgetUsd;
      responsePeriod = existingEnt.period ?? plan.period;
    } else {
      responseBudgetRemaining = existingEnt.budgetUsdRemaining ?? userBudgetUsd;
      responseBudgetTotal = existingEnt.budgetUsdTotal ?? userBudgetUsd;
      responsePeriod = existingEnt.period ?? plan.period;
    }
  }

  const sessionToken = await createSessionToken({
    userId: user.id,
    projectId: project.id,
    externalUserId: user.externalUserId,
    planSku: plan.sku,
  });

  const provider = getProviderInfo(config);

  return c.json({
    aisplinter_user_id: user.id,
    session_token: `aisplinter_sess_${sessionToken}`,
    entitlement: {
      plan_sku: plan.sku,
      plan_display_name: plan.displayName,
      budget_usd_remaining: responseBudgetRemaining,
      budget_usd_total: responseBudgetTotal,
      period: responsePeriod,
      providers: plan.providers,
      purchase_budget_usd: budgetSplit.grossUsd,
      reseller_margin_percent: budgetSplit.marginPercent,
      reseller_profit_usd: budgetSplit.profitUsd,
    },
    provider: {
      id: provider.id,
      display_name: provider.displayName,
      base_url: provider.baseUrl,
    },
    provider_api_key: provisionResult.keyRef,
    disclosure: buildProviderDisclosure(provider, minting.brandName, minting.providerDisclosureText),
  });
});

userRoutes.post('/add-budget', async (c) => {
  const project = c.get('project');
  if (!project) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  if (c.get('session')) {
    return c.json({ error: 'Add-budget requires developer API key' }, 403);
  }

  const body = await c.req.json();
  const externalUserId = typeof body.external_user_id === 'string' ? body.external_user_id.trim() : '';
  const addUsd = Number(body.add_usd);

  if (!externalUserId) {
    return c.json({ error: 'Missing external_user_id' }, 400);
  }
  if (!Number.isFinite(addUsd) || addUsd <= 0 || addUsd > 100) {
    return c.json({ error: 'add_usd must be between 0 and 100' }, 400);
  }

  const config = effectiveProjectConfig(project.config);
  if (!config) {
    return c.json({ error: 'Project upstream is not configured' }, 503);
  }
  if (config.upstreamAdapter !== 'openrouter') {
    return c.json({ error: 'Budget top-up is only supported for OpenRouter' }, 400);
  }

  const minting = getMintingFromConfig(config);
  const budgetSplit = splitBudgetByResellerMargin(addUsd, minting.resellerMarginPercent);
  const userAddUsd = budgetSplit.userBudgetUsd;

  const managementKey = config.openrouterKey?.trim() ?? '';
  if (!managementKey) {
    return c.json({ error: 'OpenRouter management key is not configured' }, 503);
  }

  const user = await db.query.users.findFirst({
    where: and(eq(users.projectId, project.id), eq(users.externalUserId, externalUserId)),
  });
  if (!user?.upstreamKeyRef?.trim()) {
    return c.json({ error: 'User has no provisioned upstream key' }, 404);
  }

  const entitlement = await db.query.entitlements.findFirst({
    where: eq(entitlements.userId, user.id),
  });
  if (!entitlement) {
    return c.json({ error: 'User has no entitlement' }, 404);
  }

  const period = entitlement.period;
  const orMeta = readUserOpenRouterMetadata(user.metadata);
  let keyHash = orMeta.activeKeyHash?.trim() ?? null;

  if (!keyHash) {
    const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, period);
    const grouped = groupOpenRouterKeysByUserId(allKeys, project.id);
    const bundle = buildUserOpenRouterKeyBundle({
      userId: user.id,
      period,
      activeKeyRef: user.upstreamKeyRef,
      metadata: user.metadata,
      managementKeys: grouped.get(user.id) ?? [],
    });
    keyHash = bundle.activeKeyHash;
  }

  if (!keyHash) {
    return c.json({ error: 'Could not resolve OpenRouter key for user' }, 502);
  }

  const currentKey =
    (await fetchOpenRouterKeyByHash(managementKey, keyHash, period)) ??
    (await (async () => {
      const stats = await fetchOpenRouterKeyStats(user.upstreamKeyRef!, period);
      if (!stats?.budgetUsdTotal) return null;
      return {
        hash: keyHash!,
        name: '',
        label: '',
        disabled: false,
        usageUsdTotal: stats.usageUsdTotal,
        usageUsdCycle: stats.usageUsdCycle,
        limitUsd: stats.budgetUsdTotal,
        limitRemainingUsd: stats.budgetUsdRemaining,
        limitReset: stats.limitReset,
        createdAt: null,
      };
    })());

  const currentLimit =
    currentKey?.limitUsd ??
    entitlement.budgetUsdTotal ??
    0;
  const newLimitUsd = Math.round((currentLimit + userAddUsd) * 100) / 100;

  const patched = await patchOpenRouterKeyLimit(managementKey, keyHash, newLimitUsd);
  if (!patched) {
    return c.json({ error: 'OpenRouter budget update failed' }, 502);
  }

  const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, period);
  const grouped = groupOpenRouterKeysByUserId(allKeys, project.id);
  const bundle = buildUserOpenRouterKeyBundle({
    userId: user.id,
    period,
    activeKeyRef: user.upstreamKeyRef,
    metadata: user.metadata,
    managementKeys: grouped.get(user.id) ?? [],
  });
  const stats = await syncOpenRouterUserFromBundle(user.id, bundle);

  const budgetUsdTotal = stats.budgetUsdTotal ?? newLimitUsd;
  const budgetUsdRemaining =
    stats.budgetUsdRemaining ??
    Math.max(0, newLimitUsd - (currentKey?.usageUsdCycle ?? 0));

  await recordResellerProfit(user.id, project.id, budgetSplit, { kind: 'top_up' });

  return c.json({
    aisplinter_user_id: user.id,
    added_usd: userAddUsd,
    purchase_usd: budgetSplit.grossUsd,
    reseller_margin_percent: budgetSplit.marginPercent,
    reseller_profit_usd: budgetSplit.profitUsd,
    entitlement: {
      plan_sku: entitlement.planSku,
      budget_usd_remaining: budgetUsdRemaining,
      budget_usd_total: budgetUsdTotal,
      period: entitlement.period,
    },
  });
});

userRoutes.get('/me', async (c) => {
  const user = c.get('user');
  const project = c.get('project');
  if (!user || !project) {
    return c.json({ error: 'Session required — use a user session token' }, 401);
  }

  const config = effectiveProjectConfig(project.config);
  if (!config) {
    return c.json({ error: 'Project upstream is not configured' }, 503);
  }
  const minting = getMintingFromConfig(config);
  const provider = getProviderInfo(config);

  const entitlement = await db.query.entitlements.findFirst({
    where: eq(entitlements.userId, user.id),
  });

  let liveEntitlement = entitlement;
  if (
    config.upstreamAdapter === 'openrouter' &&
    user.upstreamKeyRef?.trim() &&
    entitlement
  ) {
    const managementKey = config.openrouterKey?.trim() ?? '';
    let stats = null;
    if (managementKey) {
      const allKeys = await fetchAllOpenRouterManagementKeys(managementKey, entitlement.period);
      const grouped = groupOpenRouterKeysByUserId(allKeys, project.id);
      const bundle = buildUserOpenRouterKeyBundle({
        userId: user.id,
        period: entitlement.period,
        activeKeyRef: user.upstreamKeyRef,
        metadata: user.metadata,
        managementKeys: grouped.get(user.id) ?? [],
      });
      stats = await syncOpenRouterUserFromBundle(user.id, bundle);
    } else {
      stats = await fetchOpenRouterKeyStats(user.upstreamKeyRef, entitlement.period);
      if (stats) {
        await syncOpenRouterUserFromBundle(user.id, {
          keys: [],
          combined: stats,
          activeKeyHash: null,
        });
      }
    }
    if (stats) {
      liveEntitlement = {
        ...entitlement,
        budgetUsdRemaining:
          stats.budgetUsdRemaining ?? entitlement.budgetUsdRemaining,
        budgetUsdTotal: stats.budgetUsdTotal ?? entitlement.budgetUsdTotal,
      };
    }
  }

  return c.json({
    aisplinter_user_id: user.id,
    external_user_id: user.externalUserId,
    entitlement: liveEntitlement
      ? {
          plan_sku: liveEntitlement.planSku,
          budget_usd_remaining: liveEntitlement.budgetUsdRemaining,
          budget_usd_total: liveEntitlement.budgetUsdTotal,
          period: liveEntitlement.period,
        }
      : null,
    provider: {
      id: provider.id,
      display_name: provider.displayName,
      base_url: provider.baseUrl,
      docs_url: provider.docsUrl,
      key_format: provider.keyFormat,
    },
    provider_api_key: user.upstreamKeyRef ?? null,
    show_provider_branding: minting.showProviderBranding,
    brand_name: minting.brandName,
    disclosure: buildProviderDisclosure(provider, minting.brandName, minting.providerDisclosureText),
  });
});

export { userRoutes };
