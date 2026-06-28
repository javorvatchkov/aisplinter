import type { Hono } from 'hono';

type RouteHandler = (request: Request, context?: unknown) => Response | Promise<Response>;

type AnyHono = Hono<any, any, any>;

/**
 * Next.js App Router handlers that forward all methods to a Hono app.
 *
 * @example
 * ```ts
 * // app/api/aisplinter/[...path]/route.ts
 * import { getAisplinterApp } from '@/lib/aisplinter-server';
 * import { createNextRouteHandlers } from '@aisplinter/server/next';
 *
 * const handlers = createNextRouteHandlers(() => getAisplinterApp());
 * export const { GET, POST, PUT, PATCH, DELETE, OPTIONS } = handlers;
 * ```
 */
export function createNextRouteHandlers(
  getApp: () => Promise<AnyHono> | AnyHono,
): Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS', RouteHandler> {
  const handler: RouteHandler = async (request) => {
    const app = await getApp();
    return app.fetch(request);
  };

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    PATCH: handler,
    DELETE: handler,
    OPTIONS: handler,
  };
}

/**
 * Lazy singleton helper for Next.js — bootstraps once per process.
 */
export function createAisplinterSingleton(
  factory: () => Promise<AnyHono>,
): () => Promise<AnyHono> {
  let promise: Promise<AnyHono> | null = null;
  return () => {
    if (!promise) {
      promise = factory();
    }
    return promise;
  };
}
