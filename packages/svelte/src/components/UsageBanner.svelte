<script lang="ts">
  import { onMount } from 'svelte';
  import type { AisplinterAppearance } from '@aisplinter/core';
  import { getAisplinter } from '../index.js';
  import { appearanceStyle } from '../appearance.js';

  type Props = { appearance?: AisplinterAppearance; class?: string };
  let { appearance, class: className = '' }: Props = $props();

  const aisplinter = getAisplinter();
  let remaining = $state<number | null>(null);
  let total = $state<number | null>(null);
  let planSku = $state<string | null>(null);
  const rootStyle = $derived(appearanceStyle(appearance));
  const pct = $derived(total && total > 0 && remaining != null ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0);
  const low = $derived(total != null && remaining != null && total > 0 && remaining / total < 0.2);

  onMount(async () => {
    try {
      const data = await aisplinter.client.users.me();
      if (data.entitlement) {
        remaining = data.entitlement.budget_usd_remaining;
        total = data.entitlement.budget_usd_total;
        planSku = data.entitlement.plan_sku;
      }
    } catch { /* no session */ }
  });
</script>

{#if remaining != null && total != null}
  <div class="aispl-usage {className}" class:aispl-usage--low={low} style={rootStyle}>
    <div class="aispl-usage-head">
      <span>{planSku ? `${planSku} · ` : ''}${remaining.toFixed(2)} remaining</span>
      <span class="aispl-usage-total">${total.toFixed(2)} budget</span>
    </div>
    <div class="aispl-bar"><div class="aispl-bar-fill" class:aispl-bar-fill--low={low} style="width: {pct}%"></div></div>
  </div>
{/if}

<style>
  .aispl-usage {
    padding: 0.75rem 1rem; border-radius: var(--aispl-radius, 12px);
    border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
    font-size: 0.8rem; color: #d4d4d8;
  }
  .aispl-usage--low { border-color: rgba(251,191,36,0.35); }
  .aispl-usage-head { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
  .aispl-usage-total { color: #71717a; }
  .aispl-bar { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.08); overflow: hidden; }
  .aispl-bar-fill { height: 100%; background: var(--aispl-accent); transition: width 0.3s; }
  .aispl-bar-fill--low { background: #fbbf24; }
</style>
