/** Physical Postgres table names — prefixed so they never collide with app tables like `users`. */
export const AISPLINTER_TABLES = {
  projects: 'aisplinter_projects',
  users: 'aisplinter_users',
  entitlements: 'aisplinter_entitlements',
  usageLedger: 'aisplinter_usage_ledger',
  webhookDeliveries: 'aisplinter_webhook_deliveries',
} as const;

/** Legacy V0 table names (pre-prefix); migrated automatically when present. */
export const LEGACY_TABLES = {
  projects: 'projects',
  users: 'users',
  entitlements: 'entitlements',
  usageLedger: 'usage_ledger',
  webhookDeliveries: 'webhook_deliveries',
} as const;

export function qualifyTable(schema: string | undefined, table: string): string {
  if (!schema) return `"${table}"`;
  const esc = (id: string) => `"${id.replace(/"/g, '""')}"`;
  return `${esc(schema)}.${esc(table)}`;
}
