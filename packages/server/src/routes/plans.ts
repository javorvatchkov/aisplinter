import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getPlansForProject, toPublicPlanViews } from '../plans/index.js';
import { getMintingFromConfig, type MintingConfig } from '../admin/minting.js';
import { splitBudgetByResellerMargin } from '../utils/resellerMargin.js';
import type { AppVariables } from '../types.js';

const planRoutes = new Hono<{ Variables: AppVariables }>();

planRoutes.get('/', authMiddleware, async (c) => {
  const project = c.get('project');
  if (!project) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  const config = project.config as {
    upstreamAdapter: 'openrouter' | 'litellm';
    minting?: Partial<MintingConfig>;
  };
  const minting = getMintingFromConfig(config);
  const plans = getPlansForProject(config);
  const marginPercent = minting.resellerMarginPercent;

  return c.json({
    plans: toPublicPlanViews(plans, config.upstreamAdapter).map((p) => {
      const split = splitBudgetByResellerMargin(p.budgetUsd, marginPercent);
      return {
        ...p,
        purchase_budget_usd: split.grossUsd,
        user_budget_usd: split.userBudgetUsd,
        reseller_margin_percent: split.marginPercent,
      };
    }),
    default_plan_sku: minting.defaultPlanSku,
    show_provider_branding: minting.showProviderBranding,
    brand_name: minting.brandName,
    ui_accent_color: minting.uiAccentColor,
    reseller_margin_percent: marginPercent,
  });
});

export { planRoutes };
