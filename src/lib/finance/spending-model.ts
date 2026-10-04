import type { FinancialProfile, SpendingForecast } from "./types.ts";
import { buildDailySpendingRecords } from "./daily-spending.ts";
import { predictBaselineSpending } from "./spending-baseline.ts";

/** Regularized weekday regression: learns seven weekday levels from recent history. */
export function predictLearnedSpending(profile: FinancialProfile, forecastDays = 14): SpendingForecast {
  const baseline = predictBaselineSpending(profile, forecastDays);
  const records = buildDailySpendingRecords(profile).slice(-84);
  if (records.length < 28) return {
    ...baseline,
    assumptions: [...baseline.assumptions, "ML requires at least 28 complete days; using the baseline instead."],
  };
  const total = records.reduce((sum, day) => sum + day.variableSpendingCents, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Training spending exceeds the supported range.");
  const mean = total / records.length;
  // Two prior observations at the global mean shrink noisy weekday estimates.
  const levels = Array.from({ length: 7 }, (_, weekday) => {
    const days = records.filter(day => day.dayOfWeek === weekday);
    return (days.reduce((sum, day) => sum + day.variableSpendingCents, 0) + 2 * mean) / (days.length + 2);
  });
  const residual = Math.sqrt(records.reduce((sum, day) =>
    sum + (day.variableSpendingCents - levels[day.dayOfWeek]) ** 2, 0) / records.length);
  return {
    method: "machine-learning",
    predictions: baseline.predictions.map(day => {
      const predictedCents = Math.round(levels[new Date(`${day.date}T00:00:00Z`).getUTCDay()]);
      const upperEstimateCents = Math.ceil(predictedCents + residual);
      if (!Number.isSafeInteger(upperEstimateCents)) throw new Error("Predicted spending exceeds the supported range.");
      return { date: day.date, predictedCents,
        lowerEstimateCents: Math.max(0, Math.floor(predictedCents - residual)), upperEstimateCents };
    }),
    assumptions: [
      `Learns weekday spending levels from the latest ${records.length} complete calendar days, including zero-spending days.`,
      "Weekday regression uses two global-mean prior observations per weekday to reduce overfitting.",
      "Assumes history is complete and weekday patterns continue; does not learn semester changes or income timing.",
      "Bounds are one training residual RMS around the prediction, not calibrated confidence intervals.",
      "Income and scheduled expenses are excluded and must be handled separately by the engine.",
    ],
  };
}

export interface SpendingEvaluation {
  status: "evaluated" | "insufficient-history";
  folds: number;
  predictedDays: number;
  baseline: { maeCents: number; rmseCents: number } | null;
  machineLearning: { maeCents: number; rmseCents: number } | null;
  improvementPercent: number | null;
  recommendedMethod: SpendingForecast["method"];
  assumptions: string[];
}

/** Expanding chronological folds, disjoint targets, and identical forecast horizons. */
export function evaluateSpendingModel(profile: FinancialProfile, horizonDays = 14): SpendingEvaluation {
  predictBaselineSpending(profile, horizonDays); // Reuse public input validation.
  const records = buildDailySpendingRecords(profile);
  const errors = { baseline: [] as number[], machineLearning: [] as number[] };
  let folds = 0;
  for (let trainingDays = 28; trainingDays + horizonDays <= records.length; trainingDays += horizonDays) {
    const cutoff = records[trainingDays - 1].date;
    const training = { ...profile, asOfDate: cutoff,
      transactions: profile.transactions.filter(transaction => transaction.date <= cutoff),
      scheduledCashFlows: [] };
    const baseline = predictBaselineSpending(training, horizonDays);
    const learned = predictLearnedSpending(training, horizonDays);
    for (let i = 0; i < horizonDays; i += 1) {
      const actual = records[trainingDays + i].variableSpendingCents;
      errors.baseline.push(baseline.predictions[i].predictedCents - actual);
      errors.machineLearning.push(learned.predictions[i].predictedCents - actual);
    }
    folds += 1;
  }
  const metrics = (values: number[]) => ({
    maeCents: values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length,
    rmseCents: Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0) / values.length),
  });
  const baseline = folds ? metrics(errors.baseline) : null;
  const machineLearning = folds ? metrics(errors.machineLearning) : null;
  return {
    status: folds ? "evaluated" : "insufficient-history", folds, predictedDays: errors.baseline.length,
    baseline, machineLearning,
    improvementPercent: baseline && machineLearning && baseline.maeCents > 0
      ? 100 * (baseline.maeCents - machineLearning.maeCents) / baseline.maeCents : null,
    recommendedMethod: baseline && machineLearning && machineLearning.maeCents < baseline.maeCents
      ? "machine-learning" : "baseline",
    assumptions: [
      `Uses ${horizonDays}-day forecasts after at least 28 training days; targets do not overlap.`,
      "Each fold trains only on transactions through its cutoff; no future spending is available to either predictor.",
      "MAE and RMSE are daily variable-spending errors in cents; lower is better.",
      "This historical comparison guides selection but is not independent evidence of future performance.",
    ],
  };
}

export function selectSpendingForecast(profile: FinancialProfile, forecastDays = 14) {
  const evaluation = evaluateSpendingModel(profile);
  const forecast = evaluation.recommendedMethod === "machine-learning"
    ? predictLearnedSpending(profile, forecastDays) : predictBaselineSpending(profile, forecastDays);
  return { forecast, evaluation };
}
