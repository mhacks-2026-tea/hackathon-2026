import type { FinancialProfile, SpendingForecast } from "./types.ts";
import { summarizeFinances } from "./financial-summary.ts";

/** UTC arithmetic keeps calendar days independent of daylight-saving changes. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Predict variable spending using the latest 28 observed calendar days.
 * This is a simple historical baseline, not a trained ML model.
 * Predictions start the day after asOfDate; today is treated as complete.
 */
export function predictBaselineSpending(
  profile: FinancialProfile,
  forecastDays = 14,
): SpendingForecast {
  // Reuse the summary's date, amount, and duplicate-transaction validation.
  summarizeFinances(profile);
  if (!Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 366) {
    throw new Error("Forecast length must be between 1 and 366 whole days.");
  }

  // Short histories use all available days instead of pretending we have 28.
  const end = Date.parse(`${profile.asOfDate}T00:00:00.000Z`);
  const start = Math.max(
    Date.parse(`${profile.historyStartDate}T00:00:00.000Z`),
    end - 27 * DAY_MS,
  );
  const observedDays = Math.round((end - start) / DAY_MS) + 1;
  const dailyTotals = Array<number>(observedDays).fill(0);

  // Zero-spending days stay in the denominator. Income and scheduled bills
  // are excluded because the cash-flow engine accounts for them separately.
  for (const transaction of profile.transactions) {
    if (transaction.direction !== "expense" || transaction.spendingType !== "variable") continue;
    const date = Date.parse(`${transaction.date}T00:00:00.000Z`);
    if (date < start || date > end) continue;
    const index = Math.round((date - start) / DAY_MS);
    dailyTotals[index] += transaction.amountCents;
  }

  // Guard the total before division, then round back to whole cents.
  const total = dailyTotals.reduce((sum, amount) => sum + amount, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error("Observed spending exceeds the supported range.");
  }
  const predictedCents = Math.round(total / observedDays);

  // These bounds describe observed daily variation, not confidence intervals.
  // Including the rounded mean guarantees lower <= prediction <= upper.
  const lowerEstimateCents = Math.min(...dailyTotals, predictedCents);
  const upperEstimateCents = Math.max(...dailyTotals, predictedCents);
  const assumptions = [
    `Uses average daily variable spending over ${observedDays} observed days, including zero-spending days.`,
    "Assumes the recorded history is complete through the as-of date.",
    "Assumes recent average spending continues; does not yet learn weekday or semester patterns.",
    "Lower and upper estimates are observed daily minimum and maximum, not calibrated probability bounds.",
    "Excludes income and scheduled expenses; these must be handled separately in the cash-flow forecast.",
  ];
  if (observedDays < 28) {
    assumptions.push("Less than 28 days of history is available; treat this forecast as provisional.");
  }

  // Match the output contract that the future ML model will also implement.
  return {
    method: "baseline",
    predictions: Array.from({ length: forecastDays }, (_, index) => ({
      date: new Date(end + (index + 1) * DAY_MS).toISOString().slice(0, 10),
      predictedCents,
      lowerEstimateCents,
      upperEstimateCents,
    })),
    assumptions,
  };
}
