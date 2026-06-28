import { randomBytes } from 'crypto';

const NEON_OAUTH_AUTHORIZE = 'https://oauth2.neon.tech/oauth2/auth';
const NEON_OAUTH_TOKEN = 'https://oauth2.neon.tech/oauth2/token';
const NEON_API_BASE = 'https://console.neon.tech/api/v2';

export interface NeonOAuthConfig {
  clientId: string;
  clientSecret: string;
}

export interface NeonPendingAuth {
  redirectAfter?: string;
  dbSchema?: string;
  createdAt: number;
}

const pendingAuth = new Map<string, NeonPendingAuth>();
const PENDING_TTL_MS = 15 * 60 * 1000;

export function getNeonOAuthConfig(): NeonOAuthConfig | null {
  const clientId = process.env.NEON_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.NEON_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isNeonOAuthConfigured(): boolean {
  return getNeonOAuthConfig() !== null;
}

function purgeExpiredPending(): void {
  const now = Date.now();
  for (const [state, entry] of pendingAuth) {
    if (now - entry.createdAt > PENDING_TTL_MS) {
      pendingAuth.delete(state);
    }
  }
}

export function createNeonOAuthState(input?: {
  redirectAfter?: string;
  dbSchema?: string;
}): string {
  purgeExpiredPending();
  const state = randomBytes(24).toString('hex');
  pendingAuth.set(state, {
    redirectAfter: input?.redirectAfter,
    dbSchema: input?.dbSchema,
    createdAt: Date.now(),
  });
  return state;
}

export function consumeNeonOAuthState(state: string): NeonPendingAuth | null {
  purgeExpiredPending();
  const entry = pendingAuth.get(state);
  if (!entry) return null;
  pendingAuth.delete(state);
  if (Date.now() - entry.createdAt > PENDING_TTL_MS) return null;
  return entry;
}

export function buildNeonAuthorizeUrl(redirectUri: string, state: string): string {
  const config = getNeonOAuthConfig();
  if (!config) {
    throw new Error('Neon OAuth is not configured on this AISplinter server');
  }
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid offline',
    state,
  });
  return `${NEON_OAUTH_AUTHORIZE}?${params.toString()}`;
}

export async function exchangeNeonOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string }> {
  const config = getNeonOAuthConfig();
  if (!config) {
    throw new Error('Neon OAuth is not configured on this AISplinter server');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const res = await fetch(NEON_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `Neon token exchange failed (HTTP ${res.status})`,
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  };
}

async function neonApi<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${NEON_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-json */
  }

  if (!res.ok) {
    const errBody = data as { message?: string; error?: string };
    const msg =
      errBody.message ||
      errBody.error ||
      text.slice(0, 280) ||
      `Neon API error (HTTP ${res.status})`;
    throw new Error(msg);
  }

  return data as T;
}

export interface NeonProvisionResult {
  projectId: string;
  projectName: string;
  databaseUrl: string;
  databaseName: string;
  roleName: string;
}

/**
 * Model A: create AISplinter resources in the user's Neon account (OAuth access token).
 */
export async function provisionNeonDatabaseForAisplinter(
  accessToken: string,
  opts?: { projectName?: string; databaseName?: string },
): Promise<NeonProvisionResult> {
  const projectName =
    opts?.projectName?.trim() ||
    `aisplinter-${new Date().toISOString().slice(0, 10)}-${randomBytes(3).toString('hex')}`;
  const databaseName = opts?.databaseName?.trim() || 'aisplinter';

  const created = await neonApi<{
    project: { id: string; name: string; region_id?: string };
  }>(accessToken, '/projects', {
    method: 'POST',
    body: JSON.stringify({
      project: {
        name: projectName.slice(0, 63),
        region_id: process.env.NEON_DEFAULT_REGION_ID?.trim() || 'aws-us-east-1',
      },
    }),
  });

  const projectId = created.project.id;

  const branchList = await neonApi<{
    branches: { id: string; primary?: boolean; name?: string }[];
  }>(accessToken, `/projects/${projectId}/branches`);

  const branchId =
    branchList.branches.find((b) => b.primary)?.id ?? branchList.branches[0]?.id;
  if (!branchId) {
    throw new Error('Neon project created but no branch was returned');
  }

  await neonApi(accessToken, `/projects/${projectId}/branches/${branchId}/databases`, {
    method: 'POST',
    body: JSON.stringify({
      database: { name: databaseName },
    }),
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes('already exists')) {
      throw err;
    }
  });

  const roleList = await neonApi<{ roles: { name: string }[] }>(
    accessToken,
    `/projects/${projectId}/branches/${branchId}/roles`,
  );
  const roleName = roleList.roles[0]?.name;
  if (!roleName) {
    throw new Error('Neon branch has no database role');
  }

  const uri = await neonApi<{ uri: string }>(
    accessToken,
    `/projects/${projectId}/connection_uri?database_name=${encodeURIComponent(databaseName)}&role_name=${encodeURIComponent(roleName)}&branch_id=${encodeURIComponent(branchId)}`,
  );

  if (!uri.uri?.trim()) {
    throw new Error('Neon did not return a connection URI');
  }

  return {
    projectId,
    projectName: created.project.name,
    databaseUrl: uri.uri.trim(),
    databaseName,
    roleName,
  };
}

export function neonSetupDocsUrl(): string {
  return 'https://neon.tech/docs/guides/oauth-integration';
}
