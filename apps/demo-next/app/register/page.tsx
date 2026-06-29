'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { PlanPicker } from '@aisplinter/react';

export default function RegisterPage() {
  const router = useRouter();
  const { sessionToken, setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'plan'>('email');

  useEffect(() => {
    if (sessionToken) {
      router.push('/dashboard');
    }
  }, [sessionToken, router]);

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('plan');
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <img src="/aisplinter.svg" alt="AISplinter" className="h-8 w-auto mx-auto opacity-90" />
          <h1 className="text-lg font-semibold">Get Started</h1>
        </div>

        {step === 'email' ? (
          <form onSubmit={onEmailSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
              required
            />
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-100 text-zinc-950 font-medium text-sm hover:bg-white transition-colors"
            >
              Choose Plan
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500 text-center">{email}</p>
            <PlanPicker
              externalUserId={email.trim()}
              onProvision={({ sessionToken: tok }) => {
                setSession(tok, '', email.trim());
                router.push('/dashboard');
              }}
            />
            <button
              onClick={() => setStep('email')}
              className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Back
            </button>
          </div>
        )}

        <button
          onClick={() => router.push('/login')}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Already have an account? Sign In
        </button>
      </div>
    </main>
  );
}
