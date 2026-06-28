export type PlanPeriod = 'monthly' | 'daily' | 'unlimited';

export type PlanCatalogEntry = {
  sku: string;
  displayName: string;
  description: string;
  budgetUsd: number;
  period: PlanPeriod;
  priceLabel?: string;
  modelAliases: Record<string, string>;
  providers: string[];
  features: string[];
  highlighted?: boolean;
};

export const DEFAULT_OPENROUTER_PLANS: PlanCatalogEntry[] = [
  {
    sku: 'ai_trial',
    displayName: 'AI Trial',
    description: 'Try AI features with a small monthly allowance.',
    budgetUsd: 0.5,
    period: 'monthly',
    priceLabel: 'Free trial',
    modelAliases: { fast: 'openai/gpt-4o-mini' },
    providers: ['OpenAI'],
    features: ['chat'],
  },
  {
    sku: 'ai_starter',
    displayName: 'AI Starter',
    description: 'Everyday chat, summaries, and smart suggestions.',
    budgetUsd: 5,
    period: 'monthly',
    priceLabel: '$5 / month budget',
    modelAliases: {
      fast: 'openai/gpt-4o-mini',
      smart: 'anthropic/claude-3.5-sonnet',
    },
    providers: ['OpenAI', 'Anthropic'],
    features: ['chat', 'email_summarize'],
    highlighted: true,
  },
  {
    sku: 'egocentric_basic_ai',
    displayName: 'Egocentric Basic AI',
    description: 'Managed AI for Egocentric — GPT-4o mini with a monthly allowance.',
    budgetUsd: 5,
    period: 'monthly',
    priceLabel: 'Basic AI',
    modelAliases: {
      default: 'openai/gpt-4o-mini',
    },
    providers: ['OpenAI'],
    features: ['chat', 'email_summarize'],
  },
  {
    sku: 'ai_pro',
    displayName: 'AI Pro',
    description: 'Higher limits and access to advanced models.',
    budgetUsd: 15,
    period: 'monthly',
    priceLabel: '$15 / month budget',
    modelAliases: {
      fast: 'openai/gpt-4o-mini',
      smart: 'anthropic/claude-3.5-sonnet',
      reasoning: 'anthropic/claude-3-opus',
    },
    providers: ['OpenAI', 'Anthropic'],
    features: ['chat', 'email_summarize', 'tools'],
  },
  {
    sku: 'ai_power',
    displayName: 'AI Power',
    description: 'Maximum budget for power users and teams.',
    budgetUsd: 50,
    period: 'monthly',
    priceLabel: '$50 / month budget',
    modelAliases: {
      fast: 'openai/gpt-4o-mini',
      smart: 'anthropic/claude-3.5-sonnet',
      reasoning: 'anthropic/claude-3-opus',
    },
    providers: ['OpenAI', 'Anthropic', 'Google'],
    features: ['chat', 'email_summarize', 'tools', 'priority'],
  },
];

export const DEFAULT_LITELLM_PLANS: PlanCatalogEntry[] = DEFAULT_OPENROUTER_PLANS.map((p) => ({
  ...p,
  modelAliases: Object.fromEntries(
    Object.entries(p.modelAliases).map(([alias, model]) => [
      alias,
      model.includes('/') ? model.split('/')[1]! : model,
    ]),
  ),
}));

export function adaptPlanModelsForAdapter(
  plan: PlanCatalogEntry,
  adapter: 'openrouter' | 'litellm',
): PlanCatalogEntry {
  if (adapter !== 'litellm') return plan;
  return {
    ...plan,
    modelAliases: Object.fromEntries(
      Object.entries(plan.modelAliases).map(([alias, model]) => [
        alias,
        model.includes('/') ? model.split('/').pop()! : model,
      ]),
    ),
  };
}

export function getDefaultPlans(adapter: 'openrouter' | 'litellm'): PlanCatalogEntry[] {
  return adapter === 'litellm' ? DEFAULT_LITELLM_PLANS : DEFAULT_OPENROUTER_PLANS;
}

export function findPlan(
  plans: PlanCatalogEntry[],
  sku: string,
): PlanCatalogEntry | undefined {
  return plans.find((p) => p.sku === sku);
}
