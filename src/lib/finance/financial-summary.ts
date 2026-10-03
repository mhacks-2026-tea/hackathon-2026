import type { FinancialProfile, ISODate, MoneyCents } from "./types";

/** Historical totals for one observed calendar month, in cents. */
export interface MonthlyFinancialSummary {
  month: string;
  incomeCents: MoneyCents;
  expenseCents: MoneyCents;
  variableSpendingCents: MoneyCents;
  netCashFlowCents: MoneyCents;
}

/** Observation dates make partial months visible to callers. */
export interface FinancialSummary {
  historyStartDate: ISODate;
  historyEndDate: ISODate;
  months: MonthlyFinancialSummary[];
  variableSpendingByCategory: Record<string, MoneyCents>;
}

/** Validate real calendar dates, including leap years, without local time zones. */
function validateDate(date: ISODate): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Dates must use YYYY-MM-DD.");
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
}

/** Guard accumulated totals as well as individual transaction amounts. */
function addCents(left: MoneyCents, right: MoneyCents): MoneyCents {
  const total = left + right;
  if (!Number.isSafeInteger(total)) {
    throw new Error("Financial total exceeds the supported range.");
  }
  return total;
}

/**
 * Summarize the inclusive history window; future transactions are excluded.
 * Banking normalization must exclude transfers between the user's own accounts
 * before calling this function, so they do not inflate income or expenses.
 */
export function summarizeFinances(profile: FinancialProfile): FinancialSummary {
  validateDate(profile.historyStartDate);
  validateDate(profile.asOfDate);
  if (profile.historyStartDate > profile.asOfDate) {
    throw new Error("History start must not be after the as-of date.");
  }

  // Include months with no transactions: silence is still part of the history.
  const months = new Map<string, MonthlyFinancialSummary>();
  let year = Number(profile.historyStartDate.slice(0, 4));
  let monthNumber = Number(profile.historyStartDate.slice(5, 7));
  const endMonth = profile.asOfDate.slice(0, 7);
  while (true) {
    const month = `${String(year).padStart(4, "0")}-${String(monthNumber).padStart(2, "0")}`;
    months.set(month, {
      month, incomeCents: 0, expenseCents: 0,
      variableSpendingCents: 0, netCashFlowCents: 0,
    });
    if (month === endMonth) break;
    monthNumber += 1;
    if (monthNumber > 12) { monthNumber = 1; year += 1; }
  }

  // A Map supports arbitrary merchant/category labels safely.
  const categories = new Map<string, MoneyCents>();
  const seenIds = new Set<string>();
  for (const transaction of profile.transactions) {
    validateDate(transaction.date);
    if (!Number.isSafeInteger(transaction.amountCents) || transaction.amountCents < 0) {
      throw new Error("Transactions must use non-negative integer cents.");
    }
    if (transaction.direction !== "income" && transaction.direction !== "expense") {
      throw new Error("Transaction direction must be income or expense.");
    }
    if (transaction.spendingType !== "variable" && transaction.spendingType !== "scheduled") {
      throw new Error("Transaction spending type must be variable or scheduled.");
    }
    // Filter by the stated observation window before aggregating.
    if (transaction.date < profile.historyStartDate || transaction.date > profile.asOfDate) continue;
    if (seenIds.has(transaction.id)) {
      throw new Error(`Duplicate transaction ID: ${transaction.id}`);
    }
    seenIds.add(transaction.id);
    const summary = months.get(transaction.date.slice(0, 7))!;
    if (transaction.direction === "income") {
      summary.incomeCents = addCents(summary.incomeCents, transaction.amountCents);
    } else {
      summary.expenseCents = addCents(summary.expenseCents, transaction.amountCents);
      // Scheduled bills remain in total expenses but not the spending model input.
      if (transaction.spendingType === "variable") {
        summary.variableSpendingCents = addCents(summary.variableSpendingCents, transaction.amountCents);
        categories.set(transaction.category, addCents(categories.get(transaction.category) ?? 0, transaction.amountCents));
      }
    }
    summary.netCashFlowCents = summary.incomeCents - summary.expenseCents;
  }

  // Map insertion order preserves chronological months, including empty months.
  return {
    historyStartDate: profile.historyStartDate,
    historyEndDate: profile.asOfDate,
    months: [...months.values()],
    variableSpendingByCategory: Object.fromEntries(categories),
  };
}
