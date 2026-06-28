<script lang="ts">
  import { onMount } from 'svelte';
  import type { AisplinterAppearance, PublicPlan } from '@aisplinter/core';
  import { getAisplinter } from '../index.js';
  import { appearanceStyle } from '../appearance.js';

  type Props = {
    appearance?: AisplinterAppearance;
    selectedSku?: string;
    externalUserId?: string;
    onSelect?: (plan: PublicPlan) => void;
    onProvision?: (result: { sessionToken: string; plan: PublicPlan }) => void;
    class?: string;
  };

  let {
    appearance,
    selectedSku,
    externalUserId,
    onSelect,
    onProvision,
    class: className = '',
  }: Props = $props();

  const aisplinter = getAisplinter();

  let plans = $state<PublicPlan[]>([]);
  let defaultSku = $state('ai_starter');
  let brandName = $state<string | undefined>();
  let showBranding = $state(true);
  let active = $state('');
  let loading = $state(true);
  let provisioning = $state(false);
  let error = $state<string | null>(null);

  const upstreamLabel = $derived(plans[0]?.upstreamLabel ?? 'OpenRouter');
  const rootStyle = $derived(appearanceStyle(appearance));

  onMount(async () => {
    try {
      const data = await aisplinter.client.plans.list();
      plans = data.plans;
      defaultSku = data.default_plan_sku;
      brandName = data.brand_name;
      showBranding = data.show_provider_branding;
      active = selectedSku || data.default_plan_sku;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load plans';
    } finally {
      loading = false;
    }
  });

  async function choose(plan: PublicPlan) {
    active = plan.sku;
    onSelect?.(plan);
    if (!onProvision || !externalUserId) return;
    provisioning = true;
    error = null;
    try {
      const result = await aisplinter.client.users.provision({
        external_user_id: externalUserId,
        plan_sku: plan.sku,
      });
      onProvision({ sessionToken: result.session_token, plan });
    } catch (e) {
      error = e instanceof Error ? e.message : 'Provision failed';
    } finally {
      provisioning = false;
    }
  }
</script>

<div class={className} style={rootStyle}>
  {#if loading}
    <p class="aispl-muted">Loading plans…</p>
  {:else}
    {#if showBranding}
      <p class="aispl-brand">AI via {upstreamLabel}{brandName ? ` · powered by ${brandName} billing` : ''}</p>
    {/if}
    <p class="aispl-desc">
      Choose a subscription. Models run on {upstreamLabel} (OpenAI, Anthropic, and others) — not hosted by {brandName ?? 'this app'}.
    </p>
    {#if error}<p class="aispl-error">{error}</p>{/if}
    <div class="aispl-list">
      {#each plans as plan (plan.sku)}
        {@const isActive = active === plan.sku || (!active && plan.sku === defaultSku)}
        <button
          type="button"
          class="aispl-plan"
          class:aispl-plan--active={isActive}
          disabled={provisioning}
          onclick={() => void choose(plan)}
        >
          <div class="aispl-plan-head">
            <span class="aispl-plan-name">{plan.displayName}</span>
            <span class="aispl-plan-price">{plan.priceLabel ?? `$${plan.user_budget_usd ?? plan.budgetUsd}/mo budget`}</span>
          </div>
          <p class="aispl-plan-desc">{plan.description}</p>
          <p class="aispl-plan-providers">Providers: {plan.providers.join(' · ')}</p>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .aispl-muted { color: #a1a1aa; font-size: 0.85rem; }
  .aispl-brand { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #71717a; margin-bottom: 0.75rem; }
  .aispl-desc { font-size: 0.85rem; color: #a1a1aa; margin-bottom: 1rem; line-height: 1.5; }
  .aispl-error { color: #f87171; font-size: 0.85rem; margin-bottom: 0.75rem; }
  .aispl-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .aispl-plan {
    text-align: left; padding: 0.875rem 1rem; border-radius: var(--aispl-radius, 12px);
    border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); cursor: pointer; width: 100%;
  }
  .aispl-plan--active {
    border-color: color-mix(in srgb, var(--aispl-accent) 50%, transparent);
    background: color-mix(in srgb, var(--aispl-accent) 12%, transparent);
  }
  .aispl-plan-head { display: flex; justify-content: space-between; gap: 0.5rem; }
  .aispl-plan-name { font-weight: 600; color: #fafafa; }
  .aispl-plan-price { font-size: 0.75rem; color: #a1a1aa; }
  .aispl-plan-desc { font-size: 0.8rem; color: #a1a1aa; margin-top: 0.25rem; }
  .aispl-plan-providers { font-size: 0.7rem; color: #71717a; margin-top: 0.35rem; }
</style>
