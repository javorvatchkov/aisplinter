'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAisplinterClient } from '@aisplinter/react';

export default function ProfilePage() {
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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2">
          <img src="/aisplinter.svg" alt="AISplinter" className="h-5 w-auto opacity-90" />
        </button>
        <button
          onClick={logout}
          className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
        >
          Logout
        </button>
      </header>

      <div className="max-w-sm mx-auto p-6 space-y-6">
        <h1 className="text-lg font-semibold">Profile</h1>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-zinc-500">Email</p>
            <p className="text-sm">{email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">User ID</p>
            <p className="text-sm font-mono">{user?.aisplinter_user_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Plan</p>
            <p className="text-sm">{user?.entitlement?.plan_sku ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Budget</p>
            <p className="text-sm">
              ${(user?.entitlement?.budget_usd_remaining ?? 0).toFixed(2)} / ${(user?.entitlement?.budget_usd_total ?? 0).toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Period</p>
            <p className="text-sm">{user?.entitlement?.period ?? '—'}</p>
          </div>
        </div>

        <button
          onClick={() => { logout(); router.push('/'); }}
          className="w-full py-2.5 px-4 rounded-xl border border-red-900/50 text-red-400 text-sm hover:bg-red-950/30 transition-colors"
        >
          Logout
        </button>
      </div>
    </main>
  );
}
