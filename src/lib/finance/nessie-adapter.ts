import type { FinancialProfile, ISODate, ScheduledCashFlow, Transaction } from "./types.ts";
import { summarizeFinances } from "./financial-summary.ts";

/** Structural input contract: accepts Haarun's output without importing his files. */
export interface NessieAdapterInput {
  accountType: string;
  balance: number | null;
  purchases: { id: string; merchant: string; amount: number | null; date: string | null; status: string | null }[];
  deposits: { id: string; amount: number | null; date: string | null; status: string | null }[];
  bills: { id: string; payee: string; amount: number | null; date: string | null; status: string | null }[];
}

/** User-provided context cannot be inferred reliably from historical deposits. */
export interface NessieAdapterOptions {
  asOfDate: ISODate;
  historyStartDate: ISODate;
  safetyBufferCents: number;
  /** Explicit future paychecks or other obligations, already expressed in cents. */
  additionalCashFlows?: ScheduledCashFlow[];
  /** Exclude bills replaced by the proposed apartment, such as existing rent. */
  excludedBillIds?: string[];
  /** Optional labels; merchants are not assumed to be spending categories. */
  purchaseCategories?: Record<string, string>;
  /** Explicitly identify purchases that are bills, not everyday spending. */
  scheduledPurchaseIds?: string[];
}

/** Convert the demo's dollar units into integer cents without inventing zeroes. */
function dollarsToCents(amount: number | null, allowNegative = false): number | null {
  if (amount === null || !Number.isFinite(amount) || (!allowNegative && amount < 0)) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Invalid or missing dates remain missing; they are never replaced with today. */
function validDate(date: string | null): date is ISODate {
  if (date === null || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/**
 * Pure conversion: no network calls, changes to Nessie files, or inferred paydays.
 * Warnings must accompany the profile in the UI/agent. Incomplete history must
 * not be presented as a reliable forecast; verify coverage before prediction.
 */
export function adaptNessieData(
  data: NessieAdapterInput,
  options: NessieAdapterOptions,
): { profile: FinancialProfile; warnings: string[] } {
  if (!["Checking", "Savings"].includes(data.accountType)) {
    throw new Error("Use a Checking or Savings account, not a credit balance.");
  }
  const balance = dollarsToCents(data.balance, true);
  if (balance === null) throw new Error("A valid account balance is required.");
  if (!validDate(options.asOfDate) || !validDate(options.historyStartDate)
    || options.historyStartDate > options.asOfDate) {
    throw new Error("Provide a valid inclusive history window.");
  }
  if (!Number.isSafeInteger(options.safetyBufferCents) || options.safetyBufferCents < 0) {
    throw new Error("Safety buffer must be non-negative integer cents.");
  }

  const warnings: string[] = [];
  const transactions: Transaction[] = [];
  const scheduledIds = new Set(options.scheduledPurchaseIds ?? []);
  // Only completed purchases/deposits enter history. Pending entries are not
  // silently counted as settled spending or guaranteed future cash flows.
  const appendHistory = (
    item: NessieAdapterInput["deposits"][number],
    direction: "income" | "expense",
    description: string,
    category: string,
  ): void => {
    const prefix = direction === "income" ? "deposit" : "purchase";
    if (item.status?.toLowerCase() !== "completed") {
      warnings.push(`Excluded ${prefix} ${item.id}: status is not completed.`);
      return;
    }
    const amountCents = dollarsToCents(item.amount);
    if (amountCents === null || !validDate(item.date)) {
      warnings.push(`Excluded ${prefix} ${item.id}: missing or invalid amount/date.`);
      return;
    }
    if (item.date < options.historyStartDate || item.date > options.asOfDate) return;
    transactions.push({
      id: `nessie:${prefix}:${item.id}`, date: item.date, amountCents,
      direction, description, category,
      spendingType: direction === "expense" && scheduledIds.has(item.id) ? "scheduled" : "variable",
    });
  };
  for (const purchase of data.purchases) {
    appendHistory(purchase, "expense", purchase.merchant, options.purchaseCategories?.[purchase.id] ?? "uncategorized");
  }
  for (const deposit of data.deposits) appendHistory(deposit, "income", "Nessie deposit", "income");

  // Bills retain only their explicit future due date; recurring dates are not
  // expanded yet. Completed/cancelled bills must not become future deductions.
  const scheduledCashFlows = [...(options.additionalCashFlows ?? [])];
  const excludedBills = new Set(options.excludedBillIds ?? []);
  for (const bill of data.bills) {
    if (excludedBills.has(bill.id)) continue;
    if (bill.status?.toLowerCase() !== "pending") {
      warnings.push(`Excluded bill ${bill.id}: status is not pending.`);
      continue;
    }
    const amountCents = dollarsToCents(bill.amount);
    if (amountCents === null || !validDate(bill.date)) {
      warnings.push(`Excluded bill ${bill.id}: missing or invalid amount/date.`);
      continue;
    }
    if (bill.date <= options.asOfDate) {
      warnings.push(`Bill ${bill.id} has no future due date; review whether it is overdue.`);
      continue;
    }
    scheduledCashFlows.push({
      id: `nessie:bill:${bill.id}`, label: bill.payee, date: bill.date,
      amountCents, direction: "expense", certainty: "confirmed",
    });
  }

  const profile: FinancialProfile = {
    asOfDate: options.asOfDate, historyStartDate: options.historyStartDate,
    availableBalanceCents: balance, safetyBufferCents: options.safetyBufferCents,
    transactions, scheduledCashFlows,
  };
  // Apply the engine's historical validation, including duplicate IDs.
  summarizeFinances(profile);
  warnings.push("Uses one account's returned balance snapshot; transaction history does not recalculate it.");
  warnings.push("Confirm history coverage and mark scheduled purchases before using spending predictions.");
  warnings.push("Only explicit bill dates are scheduled; future recurring bills and income require additional inputs.");
  return { profile, warnings };
}
