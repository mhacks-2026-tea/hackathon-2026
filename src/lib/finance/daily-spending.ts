import type { FinancialProfile, ISODate, MoneyCents } from "./types.ts";
import { summarizeFinances } from "./financial-summary.ts";

/** One observed day, including days with no variable purchases. */
export interface DailySpendingRecord {
  date: ISODate;
  /** UTC weekday: 0 = Sunday, 1 = Monday, ... 6 = Saturday. */
  dayOfWeek: number;
  variableSpendingCents: MoneyCents;
  transactionCount: number;
}

/**
 * Prepare chronological daily observations for forecasting and ML training.
 * Income and scheduled bills are excluded because they are modeled separately.
 * A missing purchase is treated as zero only within the declared complete
 * history window; callers must not use this to fill missing bank data.
 */
export function buildDailySpendingRecords(profile: FinancialProfile): DailySpendingRecord[] {
  // Reuse validation for real dates, monetary amounts, and duplicate IDs.
  summarizeFinances(profile);
  const start = Date.parse(`${profile.historyStartDate}T00:00:00.000Z`);
  const end = Date.parse(`${profile.asOfDate}T00:00:00.000Z`);
  const dayMs = 86_400_000;

  // Initialize every observed day so models do not learn only purchase days.
  const records: DailySpendingRecord[] = [];
  const byDate = new Map<ISODate, DailySpendingRecord>();
  for (let timestamp = start; timestamp <= end; timestamp += dayMs) {
    const date = new Date(timestamp);
    const record: DailySpendingRecord = {
      date: date.toISOString().slice(0, 10),
      dayOfWeek: date.getUTCDay(),
      variableSpendingCents: 0,
      transactionCount: 0,
    };
    records.push(record);
    byDate.set(record.date, record);
  }

  // Aggregate multiple purchases on the same day into one learning target.
  for (const transaction of profile.transactions) {
    if (transaction.direction !== "expense" || transaction.spendingType !== "variable") continue;
    const record = byDate.get(transaction.date);
    if (!record) continue; // Outside the history window, including future data.
    const total = record.variableSpendingCents + transaction.amountCents;
    if (!Number.isSafeInteger(total)) {
      throw new Error("Daily spending exceeds the supported range.");
    }
    record.variableSpendingCents = total;
    record.transactionCount += 1;
  }

  // Keep dates and counts for later feature engineering; this does not train a model.
  return records;
}
