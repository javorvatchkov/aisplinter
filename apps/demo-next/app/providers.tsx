'use client';

import React from 'react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { AisplinterProvider } from '@aisplinter/react';

function AisplinterWrapper({ children }: { children: React.ReactNode }) {
  const { sessionToken } = useAuth();
  return (
    <AisplinterProvider
      baseUrl="/api/aisplinter"
      sessionToken={sessionToken ?? undefined}
      appearance={{ accentColor: '#85AA85', colorScheme: 'dark', borderRadius: '14px' }}
    >
      {children}
    </AisplinterProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AisplinterWrapper>{children}</AisplinterWrapper>
    </AuthProvider>
  );
}
