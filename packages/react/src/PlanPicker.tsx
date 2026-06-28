import React, { useEffect, useState } from 'react';
import type { AisplinterAppearance, PublicPlan } from '@aisplinter/core';
import { useAisplinterClient } from './context.js';
import { baseCardStyle, useAppearanceStyle } from './appearance.js';

export type PlanPickerProps = {
  appearance?: AisplinterAppearance;
  selectedSku?: string;
  onSelect?: (plan: PublicPlan) => void;
  onProvision?: (result: { sessionToken: string; plan: PublicPlan }) => void;
  externalUserId?: string;
  className?: string;
};

export const PlanPicker: React.FC<PlanPickerProps> = ({
  appearance,
  selectedSku,
  onSelect,
  onProvision,
  externalUserId,
  className = '',
}) => {
  const client = useAisplinterClient();
  const style = useAppearanceStyle(appearance);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [defaultSku, setDefaultSku] = useState('ai_starter');
  const [brandName, setBrandName] = useState<string | undefined>();
  const [showBranding, setShowBranding] = useState(true);
  const [active, setActive] = useState(selectedSku ?? '');
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await client.plans.list();
        if (cancelled) return;
        setPlans(data.plans);
        setDefaultSku(data.default_plan_sku);
        setBrandName(data.brand_name);
        setShowBranding(data.show_provider_branding);
        setActive(selectedSku || data.default_plan_sku);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load plans');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, selectedSku]);

  const isDark = appearance?.colorScheme !== 'light';

  async function choose(plan: PublicPlan) {
    setActive(plan.sku);
    onSelect?.(plan);
    if (!onProvision || !externalUserId) return;
    setProvisioning(true);
    setError(null);
    try {
      const result = await client.users.provision({
        external_user_id: externalUserId,
        plan_sku: plan.sku,
      });
      onProvision({
        sessionToken: result.session_token,
        plan,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Provision failed');
    } finally {
      setProvisioning(false);
    }
  }

  if (loading) {
    return (
      <div className={className} style={{ ...baseCardStyle, ...style, color: isDark ? '#a1a1aa' : '#52525b' }}>
        Loading plans…
      </div>
    );
  }

  const upstreamLabel = plans[0]?.upstreamLabel ?? 'OpenRouter';

  return (
    <div className={className} style={{ ...baseCardStyle, ...style }}>
      {showBranding && (
        <p
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: isDark ? '#71717a' : '#a1a1aa',
            marginBottom: '0.75rem',
          }}
        >
          AI via {upstreamLabel}
          {brandName ? ` · powered by ${brandName} billing` : ''}
        </p>
      )}
      <p
        style={{
          fontSize: '0.85rem',
          color: isDark ? '#a1a1aa' : '#52525b',
          marginBottom: '1rem',
          lineHeight: 1.5,
        }}
      >
        Choose a subscription. Models run on {upstreamLabel} (OpenAI, Anthropic, and others) — not hosted by{' '}
        {brandName ?? 'this app'}.
      </p>
      {error ? (
        <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {plans.map((plan) => {
          const isActive = active === plan.sku || (!active && plan.sku === defaultSku);
          return (
            <button
              key={plan.sku}
              type="button"
              disabled={provisioning}
              onClick={() => void choose(plan)}
              style={{
                textAlign: 'left',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--aispl-radius, 12px)',
                border: isActive
                  ? '1px solid color-mix(in srgb, var(--aispl-accent) 50%, transparent)'
                  : `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                background: isActive
                  ? 'color-mix(in srgb, var(--aispl-accent) 12%, transparent)'
                  : isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.02)',
                cursor: provisioning ? 'wait' : 'pointer',
                opacity: provisioning ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: isDark ? '#fafafa' : '#18181b' }}>{plan.displayName}</span>
                <span style={{ fontSize: '0.75rem', color: isDark ? '#a1a1aa' : '#71717a' }}>
                  {plan.priceLabel ?? `$${plan.user_budget_usd ?? plan.budgetUsd}/mo budget`}
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: isDark ? '#a1a1aa' : '#71717a', marginTop: '0.25rem' }}>
                {plan.description}
              </p>
              <p style={{ fontSize: '0.7rem', color: isDark ? '#71717a' : '#a1a1aa', marginTop: '0.35rem' }}>
                Providers: {plan.providers.join(' · ')}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
