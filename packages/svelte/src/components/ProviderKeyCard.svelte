<script lang="ts">
  import { onMount } from 'svelte';
  import type { AisplinterAppearance, UserMeResponse } from '@aisplinter/core';
  import { getAisplinter } from '../index.js';
  import { appearanceStyle } from '../appearance.js';

  type Props = {
    appearance?: AisplinterAppearance;
    class?: string;
  };

  let { appearance, class: className = '' }: Props = $props();

  const aisplinter = getAisplinter();
  let profile = $state<UserMeResponse | null>(null);
  let copied = $state(false);
  let error = $state<string | null>(null);
  const rootStyle = $derived(appearanceStyle(appearance));

  onMount(async () => {
    try {
      profile = await aisplinter.client.users.me();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load profile';
    }
  });

  async function copyKey() {
    if (!profile?.provider_api_key) return;
    await navigator.clipboard.writeText(profile.provider_api_key);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }
</script>

<div class="aispl-key-card {className}" style={rootStyle}>
  {#if error}
    <p class="aispl-error">{error}</p>
  {:else if !profile}
    <p class="aispl-muted">Loading your AI key…</p>
  {:else}
    {#if profile.show_provider_branding}
      <p class="aispl-label">Your {profile.provider.display_name} API key</p>
    {/if}
    <p class="aispl-desc">{profile.disclosure}</p>
    {#if profile.provider_api_key}
      <pre class="aispl-key">{profile.provider_api_key}</pre>
      <div class="aispl-actions">
        <button type="button" class="aispl-copy" onclick={() => void copyKey()}>{copied ? 'Copied' : 'Copy key'}</button>
        <span class="aispl-url">Base URL: <code>{profile.provider.base_url}</code></span>
      </div>
      <p class="aispl-hint">Use this key in any app that supports {profile.provider.display_name}.</p>
    {:else}
      <p class="aispl-warn">No provider key yet — select a plan first.</p>
    {/if}
  {/if}
</div>

<style>
  .aispl-key-card {
    padding: 1.25rem; border-radius: var(--aispl-radius, 12px);
    border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);
  }
  .aispl-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--aispl-accent); margin-bottom: 0.5rem; }
  .aispl-desc { font-size: 0.8rem; color: #a1a1aa; line-height: 1.5; margin-bottom: 1rem; }
  .aispl-key { font-size: 0.75rem; font-family: ui-monospace, monospace; padding: 0.75rem; border-radius: calc(var(--aispl-radius, 12px) - 4px); background: #09090b; color: #86efac; overflow-x: auto; margin-bottom: 0.75rem; }
  .aispl-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
  .aispl-copy { padding: 0.5rem 1rem; border-radius: calc(var(--aispl-radius, 12px) - 4px); background: var(--aispl-accent); color: #fff; border: none; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; cursor: pointer; }
  .aispl-url { font-size: 0.7rem; color: #71717a; }
  .aispl-hint { font-size: 0.7rem; color: #52525b; margin-top: 0.75rem; }
  .aispl-warn { font-size: 0.85rem; color: #fbbf24; }
  .aispl-muted { color: #a1a1aa; }
  .aispl-error { color: #f87171; font-size: 0.85rem; }
</style>
