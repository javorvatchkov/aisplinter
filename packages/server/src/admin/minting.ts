import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { entitlements, projects } from '../db/schema.js';
import {
  adaptPlanModelsForAdapter,
  getDefaultPlans,
  type PlanCatalogEntry,
  type PlanPeriod,
} from '../plans/catalog.js';
import { getSingletonProjectRow } from './project.js';
import { clampResellerMarginPercent } from '../utils/resellerMargin.js';

export type MintingConfig = {
  defaultPlanSku: string;
  enabledPlanSkus: string[];
  plans: PlanCatalogEntry[];
  /** Developer profit margin on each purchase (0–99%). Remainder is allocated to end-user token budget. */
  resellerMarginPercent: number;
  showProviderBranding: boolean;
  providerDisclosureText?: string;
  autoProvisionOnFirstConnect: boolean;
  brandName?: string;
  uiAccentColor?: string;
};

export type MintingAdminView = Omit<MintingConfig, 'plans'> & {
  upstreamAdapter: 'openrouter' | 'litellm';
  availablePlans: PlanCatalogEntry[];
};

const DEFAULT_MINTING: MintingConfig = {
  defaultPlanSku: 'ai_starter',
  enabledPlanSkus: ['ai_trial', 'ai_starter', 'ai_pro', 'egocentric_basic_ai'],
  plans: [],
  resellerMarginPercent: 0,
  showProviderBranding: true,
  providerDisclosureText:
    'AI is provided through your selected upstream provider (OpenRouter or LiteLLM), not by this app directly. Your subscription sets a monthly budget; model requests are routed to OpenAI, Anthropic, and other providers.',
  autoProvisionOnFirstConnect: true,
  brandName: 'Egocentric',
  uiAccentColor: '#85AA85',
};

type ProjectConfig = {
  upstreamAdapter: 'openrouter' | 'litellm';
  openrouterKey?: string;
  litellmKey?: string;
  litellmBaseUrl?: string;
  minting?: Partial<MintingConfig>;
};

export type PlanCreateInput = {
  sku: string;
  displayName: string;
  description?: string;
  budgetUsd: number;
  period?: PlanPeriod;
  priceLabel?: string;
  defaultModel?: string;
  providers?: string[];
  features?: string[];
  highlighted?: boolean;
};

export type PlanUpdateInput = {
  displayName?: string;
  description?: string;
  budgetUsd?: number;
  period?: PlanPeriod;
  priceLabel?: string;
  defaultModel?: string;
  providers?: string[];
  features?: string[];
  highlighted?: boolean;
};

const SKU_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

function parseConfig(raw: unknown): ProjectConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as ProjectConfig;
  if (c.upstreamAdapter !== 'openrouter' && c.upstreamAdapter !== 'litellm') return null;
  return c;
}

function normalizeSku(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function defaultModelForAdapter(adapter: 'openrouter' | 'litellm'): string {
  return adapter === 'litellm' ? 'gpt-4o-mini' : 'openai/gpt-4o-mini';
}

function buildPlanFromInput(
  input: PlanCreateInput,
  adapter: 'openrouter' | 'litellm',
): PlanCatalogEntry {
  const sku = normalizeSku(input.sku);
  if (!SKU_PATTERN.test(sku)) {
    throw new Error('SKU must be 2–64 lowercase letters, numbers, or underscores.');
  }
  const budgetUsd = Number(input.budgetUsd);
  if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
    throw new Error('Budget must be greater than 0.');
  }
  const displayName = input.displayName?.trim();
  if (!displayName) {
    throw new Error('Display name is required.');
  }
  const defaultModel = input.defaultModel?.trim() || defaultModelForAdapter(adapter);
  const providers = (input.providers ?? ['OpenAI'])
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    sku,
    displayName,
    description: input.description?.trim() || `${displayName} plan.`,
    budgetUsd,
    period: input.period ?? 'monthly',
    priceLabel: input.priceLabel?.trim() || `$${budgetUsd} / month budget`,
    modelAliases: { default: defaultModel },
    providers: providers.length ? providers : ['OpenAI'],
    features: input.features?.length ? input.features : ['chat'],
    highlighted: input.highlighted ?? false,
  };
}

function applyPlanUpdate(
  plan: PlanCatalogEntry,
  input: PlanUpdateInput,
  adapter: 'openrouter' | 'litellm',
): PlanCatalogEntry {
  const next = { ...plan };
  if (input.displayName !== undefined) {
    const name = input.displayName.trim();
    if (!name) throw new Error('Display name is required.');
    next.displayName = name;
  }
  if (input.description !== undefined) next.description = input.description.trim();
  if (input.budgetUsd !== undefined) {
    const budgetUsd = Number(input.budgetUsd);
    if (!Number.isFinite(budgetUsd) || budgetUsd <= 0) {
      throw new Error('Budget must be greater than 0.');
    }
    next.budgetUsd = budgetUsd;
  }
  if (input.period !== undefined) next.period = input.period;
  if (input.priceLabel !== undefined) next.priceLabel = input.priceLabel.trim();
  if (input.providers !== undefined) {
    const providers = input.providers.map((p) => p.trim()).filter(Boolean);
    next.providers = providers.length ? providers : next.providers;
  }
  if (input.features !== undefined) {
    next.features = input.features.length ? input.features : next.features;
  }
  if (input.highlighted !== undefined) next.highlighted = input.highlighted;
  if (input.defaultModel !== undefined) {
    const model = input.defaultModel.trim() || defaultModelForAdapter(adapter);
    next.modelAliases = { ...next.modelAliases, default: model };
  }
  return next;
}

function mergeMinting(partial?: Partial<MintingConfig>): MintingConfig {
  return {
    ...DEFAULT_MINTING,
    ...partial,
    plans: partial?.plans ?? [],
    enabledPlanSkus:
      partial?.enabledPlanSkus?.length ? partial.enabledPlanSkus : DEFAULT_MINTING.enabledPlanSkus,
    resellerMarginPercent: clampResellerMarginPercent(
      partial?.resellerMarginPercent ?? DEFAULT_MINTING.resellerMarginPercent,
    ),
  };
}

async function persistConfig(config: ProjectConfig, projectId: string): Promise<void> {
  await getDb()
    .update(projects)
    .set({ config, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
}

async function loadProjectConfig(): Promise<{ row: NonNullable<Awaited<ReturnType<typeof getSingletonProjectRow>>>; config: ProjectConfig }> {
  const row = await getSingletonProjectRow();
  if (!row) {
    throw new Error('No AISplinter project found. Run setup first.');
  }
  const config = parseConfig(row.config);
  if (!config) {
    throw new Error('Invalid project configuration.');
  }
  return { row, config };
}

function validateMintingRefs(minting: MintingConfig, plans: PlanCatalogEntry[]): MintingConfig {
  const validSkus = new Set(plans.map((p) => p.sku));
  const next = { ...minting, plans };

  if (!validSkus.has(next.defaultPlanSku)) {
    next.defaultPlanSku = plans[0]?.sku ?? next.defaultPlanSku;
  }
  next.enabledPlanSkus = next.enabledPlanSkus.filter((sku) => validSkus.has(sku));
  if (!next.enabledPlanSkus.length && plans.length) {
    next.enabledPlanSkus = plans.map((p) => p.sku);
  }
  if (!next.enabledPlanSkus.includes(next.defaultPlanSku)) {
    next.enabledPlanSkus = [...next.enabledPlanSkus, next.defaultPlanSku];
  }
  return next;
}

export async function ensurePlansInConfig(): Promise<void> {
  const row = await getSingletonProjectRow();
  if (!row) return;

  const config = parseConfig(row.config);
  if (!config || config.minting?.plans?.length) return;

  const plans = getDefaultPlans(config.upstreamAdapter);
  const nextConfig: ProjectConfig = {
    ...config,
    minting: validateMintingRefs(mergeMinting(config.minting), plans),
  };
  await persistConfig(nextConfig, row.id);
}

export function getMintingFromConfig(config: ProjectConfig | null): MintingConfig {
  if (!config) return mergeMinting(undefined);
  const storedPlans = config.minting?.plans ?? [];
  const resolvedPlans = getStoredPlans(config);
  return validateMintingRefs(mergeMinting({ ...config.minting, plans: storedPlans }), resolvedPlans);
}

export function getStoredPlans(config: ProjectConfig | null): PlanCatalogEntry[] {
  if (!config) return [];
  return config.minting?.plans?.length
    ? config.minting.plans.map((p) => adaptPlanModelsForAdapter(p, config.upstreamAdapter))
    : getDefaultPlans(config.upstreamAdapter);
}

export async function getMintingAdminView(): Promise<MintingAdminView | null> {
  await ensurePlansInConfig();

  const row = await getSingletonProjectRow();
  if (!row) return null;

  const config = parseConfig(row.config);
  if (!config) return null;

  const minting = getMintingFromConfig(config);
  const availablePlans = getStoredPlans(config);

  const { plans: _plans, ...rest } = minting;
  return {
    ...rest,
    upstreamAdapter: config.upstreamAdapter,
    availablePlans,
  };
}

export type MintingUpdateInput = Partial<Omit<MintingConfig, 'plans'>>;

export async function updateProjectMinting(input: MintingUpdateInput): Promise<MintingAdminView> {
  const { row, config } = await loadProjectConfig();
  const plans = getStoredPlans(config);
  const patch = { ...input };
  if (patch.resellerMarginPercent !== undefined) {
    patch.resellerMarginPercent = clampResellerMarginPercent(patch.resellerMarginPercent);
  }
  const next = validateMintingRefs(
    mergeMinting({ ...config.minting, ...patch, plans: config.minting?.plans ?? plans }),
    plans,
  );

  const nextConfig: ProjectConfig = {
    ...config,
    minting: next,
  };

  await persistConfig(nextConfig, row.id);

  const view = await getMintingAdminView();
  if (!view) {
    throw new Error('Project missing after minting update.');
  }
  return view;
}

async function countUsersOnPlan(projectId: string, planSku: string): Promise<number> {
  const rows = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(entitlements)
    .where(and(eq(entitlements.projectId, projectId), eq(entitlements.planSku, planSku)));
  return rows[0]?.count ?? 0;
}

export async function createProjectPlan(input: PlanCreateInput): Promise<MintingAdminView> {
  const { row, config } = await loadProjectConfig();
  const plans = [...(config.minting?.plans ?? getDefaultPlans(config.upstreamAdapter))];
  const plan = buildPlanFromInput(
    {
      ...input,
      sku: input.sku?.trim() ? input.sku : normalizeSku(input.displayName),
    },
    config.upstreamAdapter,
  );

  if (plans.some((p) => p.sku === plan.sku)) {
    throw new Error(`Plan SKU already exists: ${plan.sku}`);
  }

  plans.push(plan);
  const minting = validateMintingRefs(
    mergeMinting({
      ...config.minting,
      plans,
      enabledPlanSkus: [...(config.minting?.enabledPlanSkus ?? DEFAULT_MINTING.enabledPlanSkus), plan.sku],
    }),
    plans,
  );

  await persistConfig({ ...config, minting }, row.id);

  const view = await getMintingAdminView();
  if (!view) throw new Error('Project missing after plan create.');
  return view;
}

export async function updateProjectPlan(sku: string, input: PlanUpdateInput): Promise<MintingAdminView> {
  const { row, config } = await loadProjectConfig();
  const plans = [...(config.minting?.plans ?? getDefaultPlans(config.upstreamAdapter))];
  const index = plans.findIndex((p) => p.sku === sku);
  if (index < 0) {
    throw new Error(`Plan not found: ${sku}`);
  }

  plans[index] = applyPlanUpdate(plans[index]!, input, config.upstreamAdapter);
  const minting = validateMintingRefs(mergeMinting({ ...config.minting, plans }), plans);
  await persistConfig({ ...config, minting }, row.id);

  const view = await getMintingAdminView();
  if (!view) throw new Error('Project missing after plan update.');
  return view;
}

export async function deleteProjectPlan(sku: string): Promise<MintingAdminView> {
  const { row, config } = await loadProjectConfig();
  const plans = [...(config.minting?.plans ?? getDefaultPlans(config.upstreamAdapter))];
  if (plans.length <= 1) {
    throw new Error('Keep at least one plan.');
  }
  if (!plans.some((p) => p.sku === sku)) {
    throw new Error(`Plan not found: ${sku}`);
  }

  const usersOnPlan = await countUsersOnPlan(row.id, sku);
  if (usersOnPlan > 0) {
    throw new Error(`Cannot delete — ${usersOnPlan} user(s) still on plan ${sku}.`);
  }

  const nextPlans = plans.filter((p) => p.sku !== sku);
  const minting = validateMintingRefs(
    mergeMinting({
      ...config.minting,
      plans: nextPlans,
      enabledPlanSkus: (config.minting?.enabledPlanSkus ?? []).filter((s) => s !== sku),
    }),
    nextPlans,
  );
  await persistConfig({ ...config, minting }, row.id);

  const view = await getMintingAdminView();
  if (!view) throw new Error('Project missing after plan delete.');
  return view;
}
