import type { Context, Next } from 'hono';
import type { AppVariables } from '../types.js';
import { db } from '../db/index.js';
import { projects, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { verifySessionToken } from '../utils/auth.js';

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.split(' ')[1];
  const externalUserId = c.req.header('X-AISplinter-User-Id');

  // Case 1: Dev API Key (aisplinter_dev_...)
  if (token.startsWith('aisplinter_dev_')) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.apiKey, token),
    });

    if (!project) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    c.set('project', project);

    if (externalUserId) {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.projectId, project.id),
          eq(users.externalUserId, externalUserId)
        ),
      });
      if (user) c.set('user', user);
    }

    return await next();
  }

  // Case 2: Session Token (aisplinter_sess_...)
  if (token.startsWith('aisplinter_sess_')) {
    const payload = await verifySessionToken(token.replace('aisplinter_sess_', ''));
    if (!payload) {
      return c.json({ error: 'Invalid or expired session token' }, 401);
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, payload.projectId),
    });

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.userId),
    });

    if (!project || !user) {
      return c.json({ error: 'Project or User no longer exists' }, 401);
    }

    c.set('project', project);
    c.set('user', user);
    c.set('session', payload);

    return await next();
  }

  return c.json({ error: 'Invalid token format' }, 401);
}
