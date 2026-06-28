import type { AisplinterConfig } from './types.js';
import type { PlansResponse, ProvisionResponse, UserMeResponse } from './types.js';

export type { AisplinterConfig } from './types.js';

export class AisplinterClient {
  constructor(private config: AisplinterConfig) {}

  private async request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    if (this.config.devKey) {
      headers.set('Authorization', `Bearer ${this.config.devKey}`);
    } else if (this.config.sessionToken) {
      headers.set('Authorization', `Bearer ${this.config.sessionToken}`);
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new AisplinterError(
        response.status,
        (error as { code?: string }).code || 'unknown_error',
        (error as { message?: string; error?: string }).message ||
          (error as { error?: string }).error ||
          'Request failed',
      );
    }

    return response;
  }

  readonly users = {
    provision: async (input: {
      external_user_id: string;
      plan_sku: string;
      metadata?: Record<string, unknown>;
    }): Promise<ProvisionResponse> => {
      const res = await this.request('/v1/users/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      return res.json();
    },
    me: async (): Promise<UserMeResponse> => {
      const res = await this.request('/v1/users/me');
      return res.json();
    },
  };

  readonly plans = {
    list: async (): Promise<PlansResponse> => {
      const res = await this.request('/v1/plans');
      return res.json();
    },
  };

  readonly chat = {
    completions: async (req: Record<string, unknown>) => {
      return this.request('/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
    },
  };
}

export class AisplinterError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AisplinterError';
  }
}

export function isBudgetExhausted(e: unknown): boolean {
  return e instanceof AisplinterError && e.status === 402;
}
