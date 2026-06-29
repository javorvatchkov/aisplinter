'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function Page() {
  const router = useRouter();
  const { sessionToken } = useAuth();

  useEffect(() => {
    if (sessionToken) {
      router.push('/dashboard');
    }
  }, [sessionToken, router]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-8">
        <div className="space-y-4">
          <img
            src="/aisplinter.svg"
            alt="AISplinter"
            className="h-16 w-auto mx-auto opacity-90"
          />
          <p className="text-sm text-zinc-400">
            Middleware for AI apps. Budgets, keys, and usage — managed.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-sm hover:bg-white transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push('/register')}
            className="w-full py-2.5 px-4 rounded-xl border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </main>
  );
}
