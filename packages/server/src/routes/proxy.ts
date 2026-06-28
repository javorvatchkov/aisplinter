import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { getAdapter } from '../adapters/index.js';
import { effectiveProjectConfig } from '../admin/project.js';
import { reserveBudget, reconcileBudget, estimateInputCost } from '../utils/ledger.js';
import { aggregateStream } from '../utils/stream.js';

import type { AppVariables } from '../types.js';

const proxy = new Hono<{ Variables: AppVariables }>();

proxy.use('/chat/completions', authMiddleware);

proxy.post('/chat/completions', async (c) => {
  const project = c.get('project');
  const user = c.get('user');

  if (!project || !user) {
    return c.json({ error: 'User not found' }, 404);
  }

  if (!user.upstreamKeyRef) {
    return c.json({ error: 'User upstream key not provisioned' }, 400);
  }

  const body = await c.req.json();
  const config = effectiveProjectConfig(project.config);
  if (!config) {
    return c.json({ error: 'Project upstream is not configured' }, 503);
  }
  const adapter = getAdapter(config.upstreamAdapter, config);

  // 1. RESERVE
  const estimatedUsd = estimateInputCost(body.messages, body.model);
  let reserveId: string;
  try {
    reserveId = await reserveBudget(user.id, project.id, estimatedUsd);
  } catch (err: any) {
    if (err.message === 'BUDGET_EXHAUSTED') {
      return c.json({
        error: {
          message: 'Budget exhausted',
          code: 'budget_exhausted',
          status: 402,
        }
      }, 402);
    }
    throw err;
  }

  // 2. PROXY
  const response = await adapter.chatCompletions(body, user.upstreamKeyRef);

  // 3. RECONCILE
  if (response instanceof Response) {
    const data = await response.clone().json();
    const usage = adapter.parseUsage(data);
    
    await reconcileBudget(
      reserveId,
      user.id,
      project.id,
      usage.estimatedUsd,
      estimatedUsd,
      usage
    );
    
    return response;
  }

  // Handle Streaming
  if (response instanceof ReadableStream) {
    const [clientStream, internalStream] = response.tee();

    // Fire-and-forget reconciliation after stream ends
    (async () => {
      try {
        const aggregation = await aggregateStream(internalStream);
        const usage = adapter.parseUsage(aggregation);
        
        await reconcileBudget(
          reserveId,
          user.id,
          project.id,
          usage.estimatedUsd,
          estimatedUsd,
          usage
        );
      } catch (err) {
        console.error('Streaming reconciliation failed:', err);
      }
    })();

    return c.body(clientStream, 200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
  }

  return c.json({ error: 'Upstream returned invalid response' }, 502);
});

export { proxy };
