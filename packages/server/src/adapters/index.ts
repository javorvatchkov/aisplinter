import { OpenRouterAdapter } from './openrouter.js';
import { LiteLLMAdapter } from './litellm.js';
import { UpstreamAdapter, UpstreamAdapterId } from './types.js';

export function getAdapter(id: UpstreamAdapterId, config: any): UpstreamAdapter {
  switch (id) {
    case 'openrouter':
      if (!config.openrouterKey) throw new Error('OpenRouter API key missing');
      return new OpenRouterAdapter(config.openrouterKey);
    case 'litellm':
      if (!config.litellmKey || !config.litellmBaseUrl) {
        throw new Error('LiteLLM Master key or Base URL missing');
      }
      return new LiteLLMAdapter(config.litellmBaseUrl, config.litellmKey);
    default:
      throw new Error(`Unknown adapter: ${id}`);
  }
}
