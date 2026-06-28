import { Hono } from 'hono';
import { readFile } from 'fs/promises';
import { adminAuthMiddleware } from '../middleware/adminAuth.js';
import {
  getProjectAdminView,
  regenerateProjectDevKey,
  testProjectUpstream,
  updateProjectUpstream,
  type UpstreamUpdateInput,
} from '../admin/project.js';
import { getMintingAdminView, updateProjectMinting, createProjectPlan, updateProjectPlan, deleteProjectPlan, type MintingUpdateInput, type PlanCreateInput, type PlanUpdateInput } from '../admin/minting.js';
import { getProjectUsersSummary, listProjectUsers, getProjectUserByExternalId } from '../admin/users.js';
import { getAdminOverviewStats } from '../admin/overview.js';
import { resolvePublicFile } from '../utils/publicFiles.js';
import type { AppVariables } from '../types.js';

const adminRoutes = new Hono<{ Variables: AppVariables }>();

function requireReady(c: { get: (k: 'databaseReady' | 'isSetupMode') => boolean }) {
  if (!c.get('databaseReady')) {
    return { error: 'Database not connected', status: 503 as const };
  }
  if (c.get('isSetupMode')) {
    return { error: 'Complete setup first at /', status: 400 as const };
  }
  return null;
}

adminRoutes.get('/project', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const project = await getProjectAdminView();
  if (!project) {
    return c.json({ error: 'No project found — run setup first' }, 404);
  }

  return c.json({
    project,
    hints: {
      envVar: 'AISPLINTER_DEV_KEY',
      copyTo: 'apps/web/.env (and optionally apps/desktop/src-tauri/.env for local dev)',
    },
  });
});

adminRoutes.put('/project/upstream', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const body = (await c.req.json<UpstreamUpdateInput>().catch(() => null)) ?? null;
  if (!body?.upstreamAdapter) {
    return c.json({ error: 'upstreamAdapter is required' }, 400);
  }

  try {
    const project = await updateProjectUpstream(body);
    return c.json({ message: 'Upstream provider saved', project });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return c.json({ error: message }, 400);
  }
});

adminRoutes.post('/project/test-upstream', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const result = await testProjectUpstream();
  return c.json(result, result.ok ? 200 : 400);
});

adminRoutes.get('/users', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const users = await listProjectUsers();
  const summary = await getProjectUsersSummary();
  return c.json({ users, summary });
});

adminRoutes.get('/users/:externalUserId', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const externalUserId = c.req.param('externalUserId')?.trim();
  if (!externalUserId) {
    return c.json({ error: 'externalUserId required' }, 400);
  }

  const user = await getProjectUserByExternalId(externalUserId);
  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }
  return c.json({ user });
});

adminRoutes.get('/overview', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const overview = await getAdminOverviewStats();
  if (!overview) {
    return c.json({ error: 'No project found — run setup first' }, 404);
  }
  return c.json({ overview });
});

adminRoutes.get('/project/minting', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const minting = await getMintingAdminView();
  if (!minting) {
    return c.json({ error: 'No project found — run setup first' }, 404);
  }
  return c.json({ minting });
});

adminRoutes.put('/project/minting', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const body = (await c.req.json<MintingUpdateInput>().catch(() => null)) ?? null;
  if (!body) {
    return c.json({ error: 'Request body required' }, 400);
  }

  try {
    const minting = await updateProjectMinting(body);
    return c.json({ message: 'Key minting settings saved', minting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return c.json({ error: message }, 400);
  }
});

adminRoutes.post('/project/plans', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const body = (await c.req.json<PlanCreateInput>().catch(() => null)) ?? null;
  if (!body?.displayName || body.budgetUsd == null) {
    return c.json({ error: 'displayName and budgetUsd are required' }, 400);
  }

  try {
    const minting = await createProjectPlan(body);
    return c.json({ message: 'Plan created', minting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Create failed';
    return c.json({ error: message }, 400);
  }
});

adminRoutes.put('/project/plans/:sku', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const sku = c.req.param('sku');
  if (!sku) {
    return c.json({ error: 'Plan SKU required' }, 400);
  }

  const body = (await c.req.json<PlanUpdateInput>().catch(() => null)) ?? null;
  if (!body) {
    return c.json({ error: 'Request body required' }, 400);
  }

  try {
    const minting = await updateProjectPlan(sku, body);
    return c.json({ message: 'Plan updated', minting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return c.json({ error: message }, 400);
  }
});

adminRoutes.delete('/project/plans/:sku', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  const sku = c.req.param('sku');
  if (!sku) {
    return c.json({ error: 'Plan SKU required' }, 400);
  }

  try {
    const minting = await deleteProjectPlan(sku);
    return c.json({ message: 'Plan deleted', minting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed';
    return c.json({ error: message }, 400);
  }
});

adminRoutes.post('/regenerate-key', adminAuthMiddleware, async (c) => {
  const block = requireReady(c);
  if (block) return c.json({ error: block.error }, block.status);

  try {
    const project = await regenerateProjectDevKey();
    return c.json({
      message: 'Developer API key regenerated. Update AISPLINTER_DEV_KEY in your .env files.',
      project,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Regenerate failed';
    return c.json({ error: message }, 400);
  }
});

export async function serveAdminHtml(): Promise<string> {
  const adminPath = await resolvePublicFile('admin.html');
  return readFile(adminPath, 'utf-8');
}

export { adminRoutes };
