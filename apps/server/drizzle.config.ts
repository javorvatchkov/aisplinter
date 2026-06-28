import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: '../../packages/server/src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://aisplinter:aisplinter@localhost:5432/aisplinter',
  },
});
