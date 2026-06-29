'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UsageBanner, ProviderKeyCard, useAisplinterClient } from '@aisplinter/react';

export default function DashboardPage() {
  const router = useRouter();
  const { sessionToken, email, logout } = useAuth();
  const client = useAisplinterClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (!sessionToken) {
      router.push('/login');
      return;
    }
    client.users.me().then((data) => setUser(data)).catch(() => setUser(null));
  }, [sessionToken, router, client]);

  const plan = user?.entitlement?.plan_sku ?? '—';
  const remaining = user?.entitlement?.budget_usd_remaining ?? 0;
  const total = user?.entitlement?.budget_usd_total ?? 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button onClick={() => router.push('/')} className="flex items-center gap-2">
          <img src="/aisplinter.svg" alt="AISplinter" className="h-5 w-auto opacity-90" />
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/profile')}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Profile
          </button>
          <button
            onClick={logout}
            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-md mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">Plan</p>
            <p className="text-sm font-medium">{plan}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Budget</p>
            <p className="text-sm font-medium">${remaining.toFixed(2)} / ${total.toFixed(2)}</p>
          </div>
        </div>

        <UsageBanner />
        <ProviderKeyCard />
      </div>
    </main>
  );
}
