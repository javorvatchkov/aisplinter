'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAisplinterClient } from '@aisplinter/react';

export default function LoginPage() {
  const router = useRouter();
  const { sessionToken, setSession } = useAuth();
  const client = useAisplinterClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionToken) {
      router.push('/dashboard');
    }
  }, [sessionToken, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await client.users.provision({
        external_user_id: email.trim(),
        plan_sku: 'ai_starter',
      });
      setSession(result.session_token, String(result.aisplinter_user_id), email.trim());
      router.push('/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/aisplinter.svg" alt="AISplinter" className="h-8 w-auto mx-auto opacity-90" />
          <h1 className="text-lg font-semibold">Sign In</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
            required
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-sm hover:bg-white transition-colors disabled:opacity-50"
          >
            {loading ? '...' : 'Continue'}
          </button>
        </form>

        <button
          onClick={() => router.push('/register')}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          New here? Choose a plan
        </button>
      </div>
    </main>
  );
}
