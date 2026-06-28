import { UpstreamAdapter, ProvisionInput, ProvisionResult, StreamAggregationResult, UsageRecord } from './types.js';

export class OpenRouterAdapter implements UpstreamAdapter {
  readonly id = 'openrouter';
  private baseUrl = 'https://openrouter.ai/api/v1';

  constructor(private managementKey: string) {}

  async provisionUserKey(input: ProvisionInput): Promise<ProvisionResult> {
    const response = await fetch(`${this.baseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.managementKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `aisplinter-${input.projectId}-${input.aisplinterUserId}`,
        limit: input.budgetUsd,
        limit_reset: input.period === 'unlimited' ? null : input.period,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter key provision failed: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      keyRef: data.key, // This is the sk-or-v1-... key
      upstreamKeyId: data.id,
    };
  }

  async updateKeyBudget(keyHash: string, budgetUsd: number, _period: string): Promise<void> {
    const hash = keyHash.trim();
    if (!hash || !Number.isFinite(budgetUsd) || budgetUsd <= 0) {
      throw new Error('Invalid OpenRouter key budget update');
    }
    const response = await fetch(`${this.baseUrl}/keys/${encodeURIComponent(hash)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${this.managementKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ limit: budgetUsd }),
    });
    if (!response.ok) {
      throw new Error(`OpenRouter key budget update failed: ${await response.text()}`);
    }
  }

  async revokeKey(keyHash: string): Promise<void> {
    const hash = keyHash.trim();
    if (!hash) return;
    const response = await fetch(`${this.baseUrl}/keys/${encodeURIComponent(hash)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${this.managementKey}` },
    });
    if (!response.ok && response.status !== 404) {
      const text = await response.text().catch(() => '');
      throw new Error(`OpenRouter key revoke failed: ${text || response.status}`);
    }
  }

  async chatCompletions(req: any, keyRef: string): Promise<Response> {
    return fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyRef}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aisplinter.io', // TODO: Make configurable
        'X-Title': 'AISplinter',
      },
      body: JSON.stringify(req),
    });
  }

  parseUsage(aggregation: StreamAggregationResult | any): UsageRecord {
    // If it's a full response (non-stream)
    if (aggregation.usage) {
      return {
        promptTokens: aggregation.usage.prompt_tokens,
        completionTokens: aggregation.usage.completion_tokens,
        totalTokens: aggregation.usage.total_tokens,
        estimatedUsd: 0, // TODO: Implement pricing lookup
        model: aggregation.model,
      };
    }

    // If it's a stream aggregation
    const providerUsage = aggregation.providerUsage;
    if (providerUsage) {
      return {
        promptTokens: providerUsage.prompt_tokens || 0,
        completionTokens: providerUsage.completion_tokens || 0,
        totalTokens: providerUsage.total_tokens || 0,
        estimatedUsd: 0,
        model: aggregation.model,
      };
    }

    // Fallback estimation (chars / 4)
    const estimatedCompletionTokens = Math.ceil(aggregation.contentLength / 4);
    return {
      promptTokens: 0, // Unknown without Tiktoken
      completionTokens: estimatedCompletionTokens,
      totalTokens: estimatedCompletionTokens,
      estimatedUsd: 0,
      model: aggregation.model,
    };
  }
}
