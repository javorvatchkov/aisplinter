import type { AisplinterAppearance } from '@aisplinter/core';
import { appearanceToCssVars } from '@aisplinter/core';

export function appearanceStyle(appearance?: AisplinterAppearance): string {
  const vars = appearanceToCssVars(appearance);
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}
