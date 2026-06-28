import { db } from '../db/index.js';
import { usageLedger, entitlements } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';

export async function reserveBudget(userId: string, projectId: string, estimatedUsd: number) {
  return await db.transaction(async (tx) => {
    // 1. Get and lock the entitlement row
    const [entitlement] = await tx
      .select()
      .from(entitlements)
      .where(eq(entitlements.userId, userId))
      .for('update');

    if (!entitlement) throw new Error('ENTITLEMENT_MISSING');
    if (entitlement.budgetUsdRemaining < estimatedUsd) throw new Error('BUDGET_EXHAUSTED');

    // 2. Create the RESERVE ledger entry
    const [reserve] = await tx.insert(usageLedger).values({
      userId,
      projectId,
      type: 'RESERVE',
      amountUsd: estimatedUsd,
      status: 'pending',
    } as any).returning();

    return reserve.id;
  });
}

export async function reconcileBudget(
  reserveId: string,
  userId: string,
  projectId: string,
  actualUsd: number,
  estimatedUsd: number,
  usage: any
) {
  await db.transaction(async (tx) => {
    // 1. Update the entitlement (releasing the reserve and subtracting actual)
    const adjustment = estimatedUsd - actualUsd;
    await tx
      .update(entitlements)
      .set({
        budgetUsdRemaining: sql`${entitlements.budgetUsdRemaining} + ${adjustment}`,
        updatedAt: new Date(),
      })
      .where(eq(entitlements.userId, userId));

    // 2. Mark the RESERVE as completed and create the CONSUMPTION entry
    await tx.insert(usageLedger).values({
      userId,
      projectId,
      type: 'CONSUMPTION',
      amountUsd: actualUsd,
      model: usage.model,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      metadata: { reserveId },
    }).returning();
  });
}

export function estimateInputCost(messages: any[], model: string): number {
  // Conservative estimate: 1 token per 4 chars
  const charCount = JSON.stringify(messages).length;
  const estimatedTokens = Math.ceil(charCount / 4);
  
  // Default to a safe high price for reservation (e.g., $0.03 per 1k tokens)
  return (estimatedTokens / 1000) * 0.03;
}
