import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { usageLedger } from '../db/schema.js';
import type { BudgetSplit } from './resellerMargin.js';

export type ResellerProfitContext = {
  kind: 'provision' | 'top_up';
  planSku?: string;
};

export async function recordResellerProfit(
  userId: string,
  projectId: string,
  split: BudgetSplit,
  context: ResellerProfitContext,
): Promise<void> {
  if (split.profitUsd <= 0) return;

  await db.insert(usageLedger).values({
    userId,
    projectId,
    type: 'ADJUSTMENT',
    amountUsd: split.profitUsd,
    metadata: {
      ...context,
      ledgerKind: 'reseller_profit',
      grossUsd: split.grossUsd,
      userBudgetUsd: split.userBudgetUsd,
      marginPercent: split.marginPercent,
    },
  });
}

export async function sumResellerProfitUsd(projectId: string): Promise<number> {
  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${usageLedger.amountUsd}), 0)::float8`,
    })
    .from(usageLedger)
    .where(
      sql`${usageLedger.projectId} = ${projectId}
        AND ${usageLedger.type} = 'ADJUSTMENT'
        AND (${usageLedger.metadata}->>'ledgerKind') = 'reseller_profit'`,
    );

  const total = rows[0]?.total ?? 0;
  return Math.round(Number(total) * 100) / 100;
}
