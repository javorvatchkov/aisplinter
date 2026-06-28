import type { Context, Next } from 'hono';

function trimSecret(): string | undefined {
  const s = process.env.AISPLINTER_ADMIN_SECRET?.trim();
  return s || undefined;
}

function isLocalhostRequest(c: Context): boolean {
  const host = (c.req.header('host') ?? '').split(':')[0].toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return true;
  }
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded === '127.0.0.1' || forwarded === '::1';
}

function bearerToken(c: Context): string {
  const auth = c.req.header('authorization')?.trim() ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return c.req.header('x-aisplinter-admin-secret')?.trim() ?? '';
}

/** Protect `/admin/*` JSON routes. HTML admin UI prompts for secret when needed. */
export async function adminAuthMiddleware(c: Context, next: Next) {
  const secret = trimSecret();
  const isDev = process.env.NODE_ENV !== 'production';

  if (!secret) {
    if (isDev && isLocalhostRequest(c)) {
      return next();
    }
    return c.json(
      {
        error:
          'Set AISPLINTER_ADMIN_SECRET in .env to use the admin API, or open this page on localhost in development.',
      },
      503,
    );
  }

  if (bearerToken(c) !== secret) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
}

export function adminSecretConfigured(): boolean {
  return !!trimSecret();
}
