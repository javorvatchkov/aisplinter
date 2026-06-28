import { UpstreamAdapter, ProvisionInput, ProvisionResult, StreamAggregationResult, UsageRecord } from './types.js';

export class LiteLLMAdapter implements UpstreamAdapter {
  readonly id = 'litellm';

  constructor(private baseUrl: string, private masterKey: string) {}

  async provisionUserKey(input: ProvisionInput): Promise<ProvisionResult> {
    const response = await fetch(`${this.baseUrl}/key/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key_alias: `aisplinter-${input.projectId}-${input.aisplinterUserId}`,
        max_budget: input.budgetUsd,
        budget_duration: input.period === 'monthly' ? '30d' : '1d', // LiteLLM format
        models: input.allowedModels,
        metadata: {
          aisplinter_user_id: input.aisplinterUserId,
          project_id: input.projectId,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM key provision failed: ${await response.text()}`);
    }

    const data = await response.json() as any;
    return {
      keyRef: data.key, // LiteLLM sk-litellm-... key
      upstreamKeyId: data.key_alias,
    };
  }

  async updateKeyBudget(keyRef: string, budgetUsd: number, _period: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/key/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.masterKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key: keyRef,
        max_budget: budgetUsd,
      }),
    });

    if (!response.ok) {
      throw new Error(`LiteLLM key update failed: ${await response.text()}`);
    }
  }

  async revokeKey(_keyRef: string): Promise<void> {
    // TODO: Implement key deletion in LiteLLM if available
  }

  async chatCompletions(req: any, keyRef: string): Promise<Response> {
    return fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyRef}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req),
    });
  }

  parseUsage(aggregation: StreamAggregationResult | any): UsageRecord {
    // LiteLLM follows OpenAI format closely
    if (aggregation.usage) {
      return {
        promptTokens: aggregation.usage.prompt_tokens,
        completionTokens: aggregation.usage.completion_tokens,
        totalTokens: aggregation.usage.total_tokens,
        estimatedUsd: 0,
        model: aggregation.model,
      };
    }

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

    const estimatedCompletionTokens = Math.ceil(aggregation.contentLength / 4);
    return {
      promptTokens: 0,
      completionTokens: estimatedCompletionTokens,
      totalTokens: estimatedCompletionTokens,
      estimatedUsd: 0,
      model: aggregation.model,
    };
  }
}
