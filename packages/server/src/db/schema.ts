import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { AISPLINTER_TABLES } from './tableNames.js';

export const projects = pgTable(AISPLINTER_TABLES.projects, {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  apiKey: text('api_key').unique().notNull(),
  webhookUrl: text('webhook_url'),
  webhookSecret: text('webhook_secret'),
  config: jsonb('config').$type<{
    upstreamAdapter: 'openrouter' | 'litellm';
    openrouterKey?: string;
    litellmKey?: string;
    litellmBaseUrl?: string;
  }>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(AISPLINTER_TABLES.users, {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  externalUserId: text('external_user_id').notNull(),
  upstreamKeyRef: text('upstream_key_ref'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  projectExternalIdx: index('aisplinter_user_project_external_idx').on(
    table.projectId,
    table.externalUserId,
  ),
}));

export const entitlements = pgTable(AISPLINTER_TABLES.entitlements, {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  planSku: text('plan_sku').notNull(),
  budgetUsdRemaining: doublePrecision('budget_usd_remaining').notNull(),
  budgetUsdTotal: doublePrecision('budget_usd_total').notNull(),
  period: text('period', { enum: ['monthly', 'daily', 'unlimited'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdUnique: uniqueIndex('aisplinter_entitlements_user_id_unique').on(table.userId),
}));

export const usageLedger = pgTable(AISPLINTER_TABLES.usageLedger, {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  type: text('type', { enum: ['RESERVE', 'CONSUMPTION', 'ADJUSTMENT'] }).notNull(),
  amountUsd: doublePrecision('amount_usd').notNull(),
  model: text('model'),
  promptTokens: doublePrecision('prompt_tokens'),
  completionTokens: doublePrecision('completion_tokens'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userCreatedIdx: index('aisplinter_usage_user_created_idx').on(table.userId, table.createdAt),
}));

export const webhookDeliveries = pgTable(AISPLINTER_TABLES.webhookDeliveries, {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id).notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status', { enum: ['PENDING', 'SUCCESS', 'FAILED'] }).notNull(),
  retryCount: doublePrecision('retry_count').default(0).notNull(),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
