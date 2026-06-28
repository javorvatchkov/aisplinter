export type UserOpenRouterKeyHistoryEntry = {
  hash?: string;
  keyHint?: string;
  retiredAt: string;
};

export type UserOpenRouterMetadata = {
  activeKeyHash?: string | null;
  keyHistory?: UserOpenRouterKeyHistoryEntry[];
};

function maskKeyHint(keyRef: string): string {
  const v = keyRef.trim();
  if (v.length <= 12) return '••••••••';
  return `${v.slice(0, 8)}…${v.slice(-4)}`;
}

export function readUserOpenRouterMetadata(metadata: unknown): UserOpenRouterMetadata {
  if (!metadata || typeof metadata !== 'object') return {};
  const root = metadata as Record<string, unknown>;
  const or = root.openrouter;
  if (!or || typeof or !== 'object') return {};
  const parsed = or as UserOpenRouterMetadata;
  return {
    activeKeyHash: typeof parsed.activeKeyHash === 'string' ? parsed.activeKeyHash : null,
    keyHistory: Array.isArray(parsed.keyHistory) ? parsed.keyHistory : [],
  };
}

/** Record retired key + set new active hash when AISplinter mints a replacement. */
export function metadataForNewUpstreamKey(
  existing: unknown,
  oldKeyRef: string | null | undefined,
  newKeyRef: string,
  newKeyHash: string | null | undefined,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object'
      ? { ...(existing as Record<string, unknown>) }
      : {};
  const or = readUserOpenRouterMetadata(existing);
  const history = [...(or.keyHistory ?? [])];

  const oldTrimmed = oldKeyRef?.trim() ?? '';
  const newTrimmed = newKeyRef.trim();
  if (oldTrimmed && oldTrimmed !== newTrimmed) {
    history.push({
      hash: or.activeKeyHash ?? undefined,
      keyHint: maskKeyHint(oldTrimmed),
      retiredAt: new Date().toISOString(),
    });
  }

  return {
    ...base,
    openrouter: {
      activeKeyHash: newKeyHash?.trim() || null,
      keyHistory: history,
    },
  };
}
