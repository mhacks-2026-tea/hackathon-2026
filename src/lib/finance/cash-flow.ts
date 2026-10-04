import type {
  DailyBalanceForecast,
  FinancialProfile,
  ISODate,
  SpendingForecast,
} from "./types.ts";

/** Calendar arithmetic uses UTC to avoid daylight-saving offsets. */
const DAY_MS = 86_400_000;

/** Reject malformed or impossible dates before scheduling any payments. */
function dateTimestamp(date: ISODate): number {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp)
    || new Date(timestamp).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return timestamp;
}

/** Money must stay within JavaScript's exact integer range. */
function validateCents(amount: number, allowNegative = false): void {
  if (!Number.isSafeInteger(amount) || (!allowNegative && amount < 0)) {
    throw new Error("Amounts must be safe integer cents; costs cannot be negative.");
  }
}

/**
 * Forecast end-of-day balances from tomorrow through the last prediction.
 * Spending predictions must cover every day in that period exactly once.
 * Estimated cash flows are included only when explicitly requested.
 * Housing costs must be supplied as dated scheduled expenses by the caller.
 * This does not model the order of payments within a single day.
 */
export function forecastCashFlow(
  profile: FinancialProfile,
  spending: SpendingForecast,
  includeEstimatedCashFlows = false,
): DailyBalanceForecast[] {
  const asOf = dateTimestamp(profile.asOfDate);
  validateCents(profile.availableBalanceCents, true);
  validateCents(profile.safetyBufferCents);

  // Sort a copy, preserving the caller's original prediction order.
  const predictions = [...spending.predictions].sort((a, b) => a.date.localeCompare(b.date));
  if (predictions.length === 0) throw new Error("At least one spending prediction is required.");
  predictions.forEach((prediction, index) => {
    const expectedDate = asOf + (index + 1) * DAY_MS;
    if (dateTimestamp(prediction.date) !== expectedDate) {
      throw new Error("Spending predictions must cover consecutive days starting tomorrow.");
    }
    validateCents(prediction.predictedCents);
  });

  // Aggregate signed payments by date; past payments are already in balance.
  const endDate = predictions[predictions.length - 1].date;
  const flows = new Map<ISODate, number>();
  const seenIds = new Set<string>();
  for (const flow of profile.scheduledCashFlows) {
    dateTimestamp(flow.date);
    validateCents(flow.amountCents);
    if (flow.direction !== "income" && flow.direction !== "expense") {
      throw new Error("Cash-flow direction must be income or expense.");
    }
    if (flow.certainty !== "confirmed" && flow.certainty !== "estimated") {
      throw new Error("Cash-flow certainty must be confirmed or estimated.");
    }
    if (seenIds.has(flow.id)) throw new Error(`Duplicate cash-flow ID: ${flow.id}`);
    seenIds.add(flow.id);
    if (flow.date <= profile.asOfDate || flow.date > endDate) continue;
    if (flow.certainty === "estimated" && !includeEstimatedCashFlows) continue;
    const signedAmount = flow.direction === "income" ? flow.amountCents : -flow.amountCents;
    const dailyTotal = (flows.get(flow.date) ?? 0) + signedAmount;
    validateCents(dailyTotal, true);
    flows.set(flow.date, dailyTotal);
  }

  // Carry the closing balance forward; negative balances remain visible.
  let balance = profile.availableBalanceCents;
  return predictions.map((prediction) => {
    const afterPayments = balance + (flows.get(prediction.date) ?? 0);
    validateCents(afterPayments, true);
    balance = afterPayments - prediction.predictedCents;
    validateCents(balance, true);
    return {
      date: prediction.date,
      projectedBalanceCents: balance,
      belowSafetyBuffer: balance < profile.safetyBufferCents,
    };
  });
}
