export const RESELLER_MARGIN_MIN = 0;
export const RESELLER_MARGIN_MAX = 99;

/** Clamp developer reseller margin to 0–99% (integer). */
export function clampResellerMarginPercent(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 0;
  return Math.min(RESELLER_MARGIN_MAX, Math.max(RESELLER_MARGIN_MIN, n));
}

export type BudgetSplit = {
  grossUsd: number;
  userBudgetUsd: number;
  profitUsd: number;
  marginPercent: number;
};

/**
 * Split a purchase / plan budget between end-user token allocation and developer profit.
 * At 0% margin the full gross amount goes to the user; at 99% only 1% is allocated.
 */
export function splitBudgetByResellerMargin(
  grossUsd: number,
  marginPercent: number,
): BudgetSplit {
  const margin = clampResellerMarginPercent(marginPercent);
  const gross = Math.round(Number(grossUsd) * 100) / 100;
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error('Gross budget must be greater than 0.');
  }
  const userBudgetUsd = Math.round(gross * (100 - margin)) / 100;
  const profitUsd = Math.round((gross - userBudgetUsd) * 100) / 100;
  return { grossUsd: gross, userBudgetUsd, profitUsd, marginPercent: margin };
}
