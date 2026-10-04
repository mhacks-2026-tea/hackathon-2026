import type { FinancialProfile, HousingScenario, SimulationResult } from "./types.ts";
import { evaluateAffordability } from "./affordability.ts";
import { predictBaselineSpending } from "./spending-baseline.ts";

/** Explicit controls make modeled risk repeatable and explainable. */
export interface SimulationOptions {
  scenarioCount?: number;
  seed?: number;
  /** Spending varies uniformly within this fraction of the baseline (0 to 1). */
  spendingVariationFraction?: number;
  includeEstimatedCashFlows?: boolean;
}

/** Seeded pseudo-random generator: identical inputs produce identical results. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run spending-only Monte Carlo scenarios against the affordability engine.
 * Income timing, housing costs, and bills remain fixed in this first version.
 * Results are scenario frequencies under chosen assumptions, not calibrated
 * probabilities of the student's real-world financial outcomes.
 */
export function simulateAffordability(
  profile: FinancialProfile,
  housing: HousingScenario,
  options: SimulationOptions = {},
): SimulationResult {
  const scenarioCount = options.scenarioCount ?? 500;
  const seed = options.seed ?? 42;
  const variation = options.spendingVariationFraction ?? 0.2;
  if (!Number.isInteger(scenarioCount) || scenarioCount < 1 || scenarioCount > 5000) {
    throw new Error("Simulation count must be between 1 and 5000 whole scenarios.");
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    throw new Error("Seed must be an unsigned 32-bit integer.");
  }
  if (!Number.isFinite(variation) || variation < 0 || variation > 1) {
    throw new Error("Spending variation must be between 0 and 1.");
  }

  // Validate the full scenario before constructing any random paths.
  const baselineResult = evaluateAffordability(profile, housing, {
    includeEstimatedCashFlows: options.includeEstimatedCashFlows,
  });
  const baseline = predictBaselineSpending(profile, baselineResult.dailyBalances.length);
  const random = seededRandom(seed);
  let belowBufferCount = 0;

  for (let index = 0; index < scenarioCount; index += 1) {
    // One multiplier per path models persistently higher or lower spending,
    // rather than independent daily noise that averages away over the lease.
    const multiplier = 1 - variation + random() * 2 * variation;
    const predictions = baseline.predictions.map((day) => {
      const predictedCents = Math.round(day.predictedCents * multiplier);
      if (!Number.isSafeInteger(predictedCents)) {
        throw new Error("Simulated spending exceeds the supported range.");
      }
      return {
        date: day.date,
        predictedCents,
        // This path has a fixed spending assumption, not its own confidence interval.
        lowerEstimateCents: predictedCents,
        upperEstimateCents: predictedCents,
      };
    });
    const result = evaluateAffordability(profile, housing, {
      includeEstimatedCashFlows: options.includeEstimatedCashFlows,
      spendingForecast: { ...baseline, predictions },
    });

    // Count each scenario once, even if it crosses the buffer on many days.
    if (profile.availableBalanceCents < profile.safetyBufferCents
      || result.dailyBalances.some((day) => day.belowSafetyBuffer)) {
      belowBufferCount += 1;
    }
  }

  return {
    scenarioCount,
    fractionBelowSafetyBuffer: belowBufferCount / scenarioCount,
    assumptions: [
      ...baselineResult.assumptions,
      `Runs ${scenarioCount} scenarios with random seed ${seed}.`,
      `Each path uniformly samples one spending multiplier between ${1 - variation} and ${1 + variation} and applies it throughout the forecast.`,
      "Spending variation is a user-selected sensitivity assumption, not learned from transaction data.",
      "Income amounts and timing, housing expenses, and scheduled bills remain fixed.",
      "A scenario is counted if its starting or any projected end-of-day balance is below the safety buffer.",
      "The reported fraction is a simulation frequency, not a validated probability of future shortfall.",
    ],
  };
}
