import { count } from 'drizzle-orm';
import { getAdapter } from '../adapters/index.js';
import { getDb } from '../db/index.js';
import { projects } from '../db/schema.js';
import {
  type EnvProjectConfig,
  canBootstrapFromEnv,
  getEnvProjectConfig,
  resolveDevKey,
  validateUpstreamConfig,
} from './envSetup.js';

export interface CreatedProject {
  id: string;
  name: string;
  apiKey: string;
}

export async function createProject(config: EnvProjectConfig): Promise<CreatedProject> {
  const existing = await getDb().select({ value: count() }).from(projects);
  if (existing[0].value > 0) {
    throw new Error('This AISplinter install already has a project (one per codebase).');
  }

  await validateUpstreamConfig(config);
  void getAdapter(config.upstreamAdapter, {
    openrouterKey: config.openrouterKey,
    litellmKey: config.litellmKey,
    litellmBaseUrl: config.litellmBaseUrl,
  });

  const apiKey = resolveDevKey(config);

  const [project] = await getDb()
    .insert(projects)
    .values({
      name: config.name,
      apiKey,
      config: {
        upstreamAdapter: config.upstreamAdapter,
        openrouterKey: config.openrouterKey,
        litellmKey: config.litellmKey,
        litellmBaseUrl: config.litellmBaseUrl,
      },
    })
    .returning();

  return { id: project.id, name: project.name, apiKey: project.apiKey };
}

export async function bootstrapProjectFromEnv(): Promise<CreatedProject | null> {
  if (!canBootstrapFromEnv()) return null;

  const config = getEnvProjectConfig();
  if (!config) return null;

  return createProject(config);
}
