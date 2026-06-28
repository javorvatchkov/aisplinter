import type { CreateAisplinterAppOptions } from './app.js';
import { createAisplinterApp } from './app.js';
import { getDefaultPort } from './env.js';

export interface StartStandaloneServerOptions extends CreateAisplinterAppOptions {
  port?: number;
}

/**
 * Start AISplinter as a standalone Node HTTP server (dev / Docker / OSS quick start).
 * Requires `@hono/node-server` in the host app.
 */
export async function startStandaloneServer(
  options: StartStandaloneServerOptions = {},
): Promise<void> {
  const { port = getDefaultPort(), ...appOptions } = options;
  const { app, databaseReady, bootstrappedFromEnv } = await createAisplinterApp(appOptions);

  const { serve } = await import('@hono/node-server');

  console.log(`AISplinter starting on port ${port}...`);
  if (!databaseReady) {
    if (process.env.DATABASE_URL?.trim()) {
      console.log('DATABASE_URL is set but connection failed — check your Neon credentials.');
    } else {
      console.log(
        `Configure DATABASE_URL + AISPLINTER_OPENROUTER_KEY in .env or open http://localhost:${port}`,
      );
    }
  } else if (bootstrappedFromEnv) {
    console.log('Ready (configured from .env). Setup UI skipped.');
  }

  serve({
    fetch: app.fetch,
    port,
  });
}
