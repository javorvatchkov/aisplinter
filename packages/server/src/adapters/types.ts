export type UpstreamAdapterId = 'openrouter' | 'litellm';

export interface ProvisionInput {
  projectId: string;
  aisplinterUserId: string;
  externalUserId: string;
  planSku: string;
  budgetUsd: number;
  period: 'monthly' | 'daily' | 'unlimited';
  allowedModels: string[];
}

export interface ProvisionResult {
  keyRef: string;
  upstreamKeyId?: string;
}

export interface UsageRecord {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedUsd: number;
  model: string;
}

export interface StreamAggregationResult {
  model: string;
  chunks: number;
  contentLength: number;
  providerUsage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  rawFinalChunk?: any;
  headers?: Record<string, string>;
}

export interface UpstreamAdapter {
  readonly id: UpstreamAdapterId;
  provisionUserKey(input: ProvisionInput): Promise<ProvisionResult>;
  updateKeyBudget(keyRef: string, budgetUsd: number, period: string): Promise<void>;
  revokeKey(keyRef: string): Promise<void>;
  chatCompletions(req: any, keyRef: string): Promise<Response | ReadableStream>;
  parseUsage(aggregation: StreamAggregationResult | any): UsageRecord;
}
