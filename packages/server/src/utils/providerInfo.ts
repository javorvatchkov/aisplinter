import type { UpstreamAdapterId } from '../adapters/types.js';

type ProjectConfig = {
  upstreamAdapter: UpstreamAdapterId;
  litellmBaseUrl?: string;
};

export type ProviderInfo = {
  id: UpstreamAdapterId;
  displayName: string;
  baseUrl: string;
  docsUrl: string;
  keyFormat: string;
};

const OPENROUTER: ProviderInfo = {
  id: 'openrouter',
  displayName: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  docsUrl: 'https://openrouter.ai/docs',
  keyFormat: 'sk-or-v1-…',
};

export function getProviderInfo(config: ProjectConfig): ProviderInfo {
  if (config.upstreamAdapter === 'litellm') {
    const base = config.litellmBaseUrl?.trim().replace(/\/+$/, '') || 'https://litellm.local';
    return {
      id: 'litellm',
      displayName: 'LiteLLM',
      baseUrl: `${base}/v1`,
      docsUrl: 'https://docs.litellm.ai/docs/',
      keyFormat: 'sk-…',
    };
  }
  return OPENROUTER;
}

export function buildProviderDisclosure(
  provider: ProviderInfo,
  brandName?: string,
  customText?: string,
): string {
  if (customText?.trim()) return customText.trim();
  const app = brandName?.trim() || 'This app';
  if (provider.id === 'openrouter') {
    return `${app} routes your AI requests through OpenRouter to model providers such as OpenAI and Anthropic. ${app} manages your subscription and monthly budget — the models are not hosted by ${app}.`;
  }
  return `${app} routes your AI requests through your organization's LiteLLM gateway. ${app} manages your subscription and budget on top of the upstream models configured in LiteLLM.`;
}
