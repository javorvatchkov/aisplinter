import type { UpstreamAdapterId } from '../adapters/types.js';
import {
  findPlan,
  getDefaultPlans,
  type PlanCatalogEntry,
} from './catalog.js';
import { getMintingFromConfig, getStoredPlans, type MintingConfig } from '../admin/minting.js';

export type PublicPlanView = PlanCatalogEntry & {
  upstreamAdapter: UpstreamAdapterId;
  upstreamLabel: string;
};

const UPSTREAM_LABELS: Record<UpstreamAdapterId, string> = {
  openrouter: 'OpenRouter',
  litellm: 'LiteLLM',
};

type ProjectPlanSource = {
  upstreamAdapter: UpstreamAdapterId;
  minting?: Partial<MintingConfig>;
};

export function getPlansForProject(source: ProjectPlanSource): PlanCatalogEntry[] {
  const minting = getMintingFromConfig(source);
  const all = getStoredPlans(source);
  const enabled = minting.enabledPlanSkus?.length ? new Set(minting.enabledPlanSkus) : null;
  const filtered = enabled ? all.filter((p) => enabled.has(p.sku)) : all;
  return filtered.length > 0 ? filtered : all;
}

export function resolvePlanForProvision(
  source: ProjectPlanSource,
  planSku: string,
): PlanCatalogEntry {
  const minting = getMintingFromConfig(source);
  const plans = getPlansForProject(source);
  const plan =
    findPlan(plans, planSku) ?? findPlan(plans, minting.defaultPlanSku ?? 'ai_starter');
  if (!plan) {
    throw new Error(`Unknown plan SKU: ${planSku}`);
  }
  return plan;
}

export function toPublicPlanViews(
  plans: PlanCatalogEntry[],
  upstreamAdapter: UpstreamAdapterId,
): PublicPlanView[] {
  const label = UPSTREAM_LABELS[upstreamAdapter];
  return plans.map((p) => ({
    ...p,
    upstreamAdapter,
    upstreamLabel: label,
  }));
}

export { findPlan, getDefaultPlans, type PlanCatalogEntry };
