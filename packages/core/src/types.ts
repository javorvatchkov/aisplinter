export type AisplinterAppearance = {
  accentColor?: string;
  borderRadius?: string;
  fontFamily?: string;
  colorScheme?: 'light' | 'dark';
};

export type AisplinterConfig = {
  baseUrl: string;
  devKey?: string;
  sessionToken?: string;
};

export const DEFAULT_APPEARANCE: AisplinterAppearance = {
  accentColor: '#6366f1',
  borderRadius: '12px',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  colorScheme: 'dark',
};

export function appearanceToCssVars(appearance?: AisplinterAppearance): Record<string, string> {
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  return {
    '--aispl-accent': a.accentColor!,
    '--aispl-radius': a.borderRadius!,
    '--aispl-font': a.fontFamily!,
  };
}

export type PublicPlan = {
  sku: string;
  displayName: string;
  description: string;
  budgetUsd: number;
  /** End-user token budget after reseller margin (same as budgetUsd when margin is 0). */
  user_budget_usd?: number;
  /** Gross purchase amount before margin split. */
  purchase_budget_usd?: number;
  reseller_margin_percent?: number;
  period: string;
  priceLabel?: string;
  modelAliases: Record<string, string>;
  providers: string[];
  features: string[];
  highlighted?: boolean;
  upstreamAdapter: 'openrouter' | 'litellm';
  upstreamLabel: string;
};

export type PlansResponse = {
  plans: PublicPlan[];
  default_plan_sku: string;
  show_provider_branding: boolean;
  brand_name?: string;
  ui_accent_color?: string;
  reseller_margin_percent?: number;
};

export type UserMeResponse = {
  aisplinter_user_id: string;
  external_user_id: string;
  entitlement: {
    plan_sku: string;
    budget_usd_remaining: number;
    budget_usd_total: number;
    period: string;
  } | null;
  provider: {
    id: 'openrouter' | 'litellm';
    display_name: string;
    base_url: string;
    docs_url: string;
    key_format: string;
  };
  provider_api_key: string | null;
  show_provider_branding: boolean;
  brand_name?: string;
  disclosure: string;
};

export type ProvisionResponse = {
  aisplinter_user_id: string;
  session_token: string;
  entitlement: {
    plan_sku: string;
    plan_display_name: string;
    budget_usd_remaining: number;
    budget_usd_total: number;
    period: string;
    providers: string[];
  };
  provider: {
    id: string;
    display_name: string;
    base_url: string;
  };
  provider_api_key: string;
  disclosure: string;
};
