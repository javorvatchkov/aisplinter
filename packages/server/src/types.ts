import type { projects, users } from './db/schema.js';

export type AuthProject = typeof projects.$inferSelect;
export type AuthUser = typeof users.$inferSelect;

export type AppVariables = {
  isSetupMode: boolean;
  databaseReady?: boolean;
  project?: AuthProject;
  user?: AuthUser;
  session?: {
    userId: string;
    projectId: string;
    externalUserId: string;
    planSku: string;
  };
};
