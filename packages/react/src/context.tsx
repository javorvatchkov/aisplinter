import React, { createContext, useContext, useMemo, useState } from 'react';
import type { AisplinterAppearance, AisplinterConfig } from '@aisplinter/core';
import { AisplinterClient, AisplinterError, appearanceToCssVars } from '@aisplinter/core';

interface AisplinterContextValue {
  client: AisplinterClient;
  error: AisplinterError | null;
  isLoading: boolean;
  appearance: AisplinterAppearance;
}

const AisplinterContext = createContext<AisplinterContextValue | null>(null);

export interface AisplinterProviderProps extends AisplinterConfig {
  children: React.ReactNode;
  appearance?: AisplinterAppearance;
  onBudgetExhausted?: (error: AisplinterError) => void;
  onError?: (error: Error) => void;
}

export const AisplinterProvider: React.FC<AisplinterProviderProps> = ({
  children,
  appearance,
  onBudgetExhausted,
  onError,
  baseUrl,
  devKey,
  sessionToken,
}) => {
  const [error, setError] = useState<AisplinterError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const client = useMemo(() => {
    const config: AisplinterConfig = { baseUrl, devKey, sessionToken };
    const baseClient = new AisplinterClient(config);

    const originalRequest = (baseClient as unknown as { request: (...args: unknown[]) => Promise<Response> })
      .request.bind(baseClient);
    (baseClient as unknown as { request: (...args: unknown[]) => Promise<Response> }).request = async (
      ...args: unknown[]
    ) => {
      setIsLoading(true);
      try {
        const res = await originalRequest(...args);
        setError(null);
        return res;
      } catch (e: unknown) {
        if (e instanceof AisplinterError) {
          setError(e);
          if (e.status === 402 && onBudgetExhausted) {
            onBudgetExhausted(e);
          }
        }
        if (onError && e instanceof Error) onError(e);
        throw e;
      } finally {
        setIsLoading(false);
      }
    };

    return baseClient;
  }, [baseUrl, devKey, sessionToken, onBudgetExhausted, onError]);

  const mergedAppearance = appearance ?? {};

  return (
    <AisplinterContext.Provider
      value={{ client, error, isLoading, appearance: mergedAppearance }}
    >
      <div style={appearanceToCssVars(mergedAppearance) as React.CSSProperties}>{children}</div>
    </AisplinterContext.Provider>
  );
};

export const useAisplinter = () => {
  const context = useContext(AisplinterContext);
  if (!context) {
    throw new Error('useAisplinter must be used within an AisplinterProvider');
  }
  return context;
};

export const useAisplinterClient = () => useAisplinter().client;
