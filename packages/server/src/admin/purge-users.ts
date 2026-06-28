import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { entitlements, usageLedger, users } from '../db/schema.js';
import { effectiveProjectConfig, getSingletonProjectRow } from './project.js';
import {
  revokeOpenRouterKeysForAisplinterUsers,
  type OpenRouterKeyRevokeResult,
} from './openrouter-sync.js';

export type { OpenRouterKeyRevokeResult };

export type AisplinterUsersDeleteResult = {
  usersDeleted: number;
  openrouterKeysDeleted: number;
  openrouterKeysFailed: number;
};

async function deleteAisplinterUserRowsByInternalIds(internalIds: string[]): Promise<number> {
  if (internalIds.length === 0) return 0;
  const db = getDb();
  await db.delete(usageLedger).where(inArray(usageLedger.userId, internalIds));
  await db.delete(entitlements).where(inArray(entitlements.userId, internalIds));
  const deleted = await db
    .delete(users)
    .where(inArray(users.id, internalIds))
    .returning({ id: users.id });
  return deleted.length;
}

/**
 * Revoke OpenRouter keys and delete AISplinter rows for Egocentric Better Auth user ids.
 */
export async function deleteAisplinterUsersByExternalIds(
  externalUserIds: string[],
): Promise<AisplinterUsersDeleteResult> {
  const ids = [...new Set(externalUserIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { usersDeleted: 0, openrouterKeysDeleted: 0, openrouterKeysFailed: 0 };
  }

  const openrouter = await revokeOpenRouterKeysForExternalUserIds(ids);

  const project = await getSingletonProjectRow();
  if (!project) {
    return {
      usersDeleted: 0,
      openrouterKeysDeleted: openrouter.keysDeleted,
      openrouterKeysFailed: openrouter.keysFailed,
    };
  }

  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.projectId, project.id), inArray(users.externalUserId, ids)));

  const internalIds = rows.map((r) => r.id);
  const usersDeleted = await deleteAisplinterUserRowsByInternalIds(internalIds);

  return {
    usersDeleted,
    openrouterKeysDeleted: openrouter.keysDeleted,
    openrouterKeysFailed: openrouter.keysFailed,
  };
}

/**
 * Delete all OpenRouter scoped keys for Egocentric accounts (by external_user_id).
 * No-op when OpenRouter is not configured or adapter is not openrouter.
 */
export async function revokeOpenRouterKeysForExternalUserIds(
  externalUserIds: string[],
): Promise<OpenRouterKeyRevokeResult> {
  const ids = [...new Set(externalUserIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  const project = await getSingletonProjectRow();
  if (!project) {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  const config = effectiveProjectConfig(project.config);
  if (config?.upstreamAdapter !== 'openrouter') {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  const managementKey = config.openrouterKey?.trim() ?? '';
  if (!managementKey) {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  const rows = await getDb()
    .select({
      id: users.id,
      metadata: users.metadata,
      upstreamKeyRef: users.upstreamKeyRef,
    })
    .from(users)
    .where(
      and(
        eq(users.projectId, project.id),
        inArray(users.externalUserId, ids),
      ),
    );

  if (rows.length === 0) {
    return { keysDeleted: 0, keysFailed: 0 };
  }

  return revokeOpenRouterKeysForAisplinterUsers(managementKey, project.id, rows);
}
