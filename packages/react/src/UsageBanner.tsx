import React, { useEffect, useState } from 'react';
import type { AisplinterAppearance } from '@aisplinter/core';
import { useAisplinterClient } from './context.js';
import { baseCardStyle, useAppearanceStyle } from './appearance.js';

export type UsageBannerProps = {
  appearance?: AisplinterAppearance;
  className?: string;
};

export const UsageBanner: React.FC<UsageBannerProps> = ({ appearance, className = '' }) => {
  const client = useAisplinterClient();
  const style = useAppearanceStyle(appearance);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [planSku, setPlanSku] = useState<string | null>(null);
  const isDark = appearance?.colorScheme !== 'light';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await client.users.me();
        if (cancelled || !data.entitlement) return;
        setRemaining(data.entitlement.budget_usd_remaining);
        setTotal(data.entitlement.budget_usd_total);
        setPlanSku(data.entitlement.plan_sku);
      } catch {
        /* no session */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (remaining == null || total == null) return null;

  const pct = total > 0 ? Math.max(0, Math.min(100, ((total - remaining) / total) * 100)) : 0;
  const low = remaining / total < 0.2;

  return (
    <div
      className={className}
      style={{
        ...baseCardStyle,
        ...style,
        padding: '0.75rem 1rem',
        borderRadius: 'var(--aispl-radius, 12px)',
        border: `1px solid ${low ? 'rgba(251,191,36,0.35)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        fontSize: '0.8rem',
        color: isDark ? '#d4d4d8' : '#3f3f46',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span>
          {planSku ? `${planSku} · ` : ''}${remaining.toFixed(2)} remaining
        </span>
        <span style={{ color: isDark ? '#71717a' : '#a1a1aa' }}>${total.toFixed(2)} budget</span>
      </div>
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: low ? '#fbbf24' : 'var(--aispl-accent)',
            transition: 'width 0.3s',
          }}
        />
      </div>
    </div>
  );
};
