'use client';

import React, { useState } from 'react';
import {
  AisplinterProvider,
  PlanPicker,
  ProviderKeyCard,
  UsageBanner,
} from '@aisplinter/react';

export default function Page() {
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 gap-8">
      <div className="text-center max-w-lg">
        <h1 className="text-2xl font-bold">AISplinter UI components</h1>
        <p className="text-sm text-zinc-400 mt-2">
          End-user plan picker, usage banner, and portable provider API key — styled via{' '}
          <code className="text-emerald-400">appearance</code> props (Stripe-style).
        </p>
      </div>

      <AisplinterProvider
        baseUrl="/api/aisplinter"
        sessionToken={sessionToken ?? undefined}
        appearance={{ accentColor: '#85AA85', colorScheme: 'dark', borderRadius: '14px' }}
      >
        <div className="w-full max-w-md space-y-6">
          <UsageBanner />
          <PlanPicker
            externalUserId="demo-user-001"
            onProvision={({ sessionToken: tok }) => setSessionToken(tok)}
          />
          {sessionToken ? <ProviderKeyCard /> : null}
        </div>
      </AisplinterProvider>
    </main>
  );
}
