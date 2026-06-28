import { getContext, setContext } from 'svelte';
import { AisplinterClient, AisplinterConfig, AisplinterError } from '@aisplinter/core';
import type { AisplinterAppearance } from '@aisplinter/core';
import { appearanceStyle } from './appearance.js';

export { appearanceStyle } from './appearance.js';

export class AisplinterState {
  client: AisplinterClient;
  error = $state<AisplinterError | null>(null);
  isLoading = $state(false);
  appearance: AisplinterAppearance;

  constructor(
    config: AisplinterConfig,
    options: {
      appearance?: AisplinterAppearance;
      onBudgetExhausted?: (e: AisplinterError) => void;
      onError?: (e: Error) => void;
    } = {},
  ) {
    this.appearance = options.appearance ?? {};
    this.client = new AisplinterClient(config);

    const originalRequest = (this.client as unknown as { request: (...args: unknown[]) => Promise<Response> })
      .request.bind(this.client);
    (this.client as unknown as { request: (...args: unknown[]) => Promise<Response> }).request = async (
      ...args: unknown[]
    ) => {
      this.isLoading = true;
      try {
        const res = await originalRequest(...args);
        this.error = null;
        return res;
      } catch (e: unknown) {
        if (e instanceof AisplinterError) {
          this.error = e;
          if (e.status === 402 && options.onBudgetExhausted) {
            options.onBudgetExhausted(e);
          }
        }
        if (options.onError && e instanceof Error) options.onError(e);
        throw e;
      } finally {
        this.isLoading = false;
      }
    };
  }
}

const KEY = Symbol('aisplinter');

export function setAisplinter(state: AisplinterState) {
  return setContext(KEY, state);
}

export function getAisplinter(): AisplinterState {
  return getContext(KEY);
}

export function aisplinterWrapperStyle(appearance?: AisplinterAppearance): string {
  return appearanceStyle(appearance);
}
