import React, { useEffect, useState } from 'react';
import type { AisplinterAppearance, UserMeResponse } from '@aisplinter/core';
import { useAisplinterClient } from './context.js';
import { baseCardStyle, useAppearanceStyle } from './appearance.js';

export type ProviderKeyCardProps = {
  appearance?: AisplinterAppearance;
  className?: string;
};

export const ProviderKeyCard: React.FC<ProviderKeyCardProps> = ({ appearance, className = '' }) => {
  const client = useAisplinterClient();
  const style = useAppearanceStyle(appearance);
  const [profile, setProfile] = useState<UserMeResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDark = appearance?.colorScheme !== 'light';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await client.users.me();
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load profile');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client]);

  async function copyKey() {
    if (!profile?.provider_api_key) return;
    await navigator.clipboard.writeText(profile.provider_api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) {
    return (
      <div className={className} style={{ ...baseCardStyle, ...style, color: '#f87171', fontSize: '0.85rem' }}>
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={className} style={{ ...baseCardStyle, ...style, color: isDark ? '#a1a1aa' : '#71717a' }}>
        Loading your AI key…
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{
        ...baseCardStyle,
        ...style,
        padding: '1.25rem',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
      }}
    >
      {profile.show_provider_branding && (
        <p
          style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--aispl-accent)',
            marginBottom: '0.5rem',
          }}
        >
          Your {profile.provider.display_name} API key
        </p>
      )}
      <p style={{ fontSize: '0.8rem', color: isDark ? '#a1a1aa' : '#52525b', lineHeight: 1.5, marginBottom: '1rem' }}>
        {profile.disclosure}
      </p>
      {profile.provider_api_key ? (
        <>
          <pre
            style={{
              fontSize: '0.75rem',
              fontFamily: 'ui-monospace, monospace',
              padding: '0.75rem',
              borderRadius: 'calc(var(--aispl-radius, 12px) - 4px)',
              background: isDark ? '#09090b' : '#f4f4f5',
              color: isDark ? '#86efac' : '#15803d',
              overflowX: 'auto',
              marginBottom: '0.75rem',
            }}
          >
            {profile.provider_api_key}
          </pre>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void copyKey()}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'calc(var(--aispl-radius, 12px) - 4px)',
                background: 'var(--aispl-accent)',
                color: '#fff',
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Copied' : 'Copy key'}
            </button>
            <span style={{ fontSize: '0.7rem', color: isDark ? '#71717a' : '#a1a1aa' }}>
              Base URL: <code>{profile.provider.base_url}</code>
            </span>
          </div>
          <p style={{ fontSize: '0.7rem', color: isDark ? '#52525b' : '#a1a1aa', marginTop: '0.75rem' }}>
            Use this key in any app that supports {profile.provider.display_name} (Cursor, Continue, custom scripts).
          </p>
        </>
      ) : (
        <p style={{ fontSize: '0.85rem', color: '#fbbf24' }}>No provider key yet — select a plan first.</p>
      )}
    </div>
  );
};
