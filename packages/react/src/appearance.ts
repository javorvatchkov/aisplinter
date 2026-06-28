import type { CSSProperties } from 'react';
import type { AisplinterAppearance } from '@aisplinter/core';
import { appearanceToCssVars } from '@aisplinter/core';

export function useAppearanceStyle(appearance?: AisplinterAppearance): CSSProperties {
  return appearanceToCssVars(appearance) as CSSProperties;
}

export const baseCardStyle: CSSProperties = {
  fontFamily: 'var(--aispl-font, system-ui, sans-serif)',
  borderRadius: 'var(--aispl-radius, 12px)',
};
