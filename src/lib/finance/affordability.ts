import type { AffordabilityResult, FinancialProfile, HousingScenario, SpendingForecast } from "./types";
import { calculateMonthlyHousingCost, calculateUpfrontCashRequired } from "./housing-costs.ts";
import { buildHousingSchedule } from "./housing-schedule.ts";
import { predictBaselineSpending } from "./spending-baseline.ts";
import { forecastCashFlow } from "./cash-flow.ts";

/** Optional inputs let us replace the baseline with ML without rewriting the engine. */
export interface AffordabilityOptions {
  spendingForecast?: SpendingForecast;
  /** Uncertain personal income and bills are excluded unless explicitly enabled. */
  includeEstimatedCashFlows?: boolean;
}

/**
 * Evaluate a proposed future apartment through the full lease.
 * Existing scheduled expenses must exclude costs replaced by this scenario,
 * such as the student's current rent after moving, to avoid double counting.
 */
export function evaluateAffordability(
  profile: FinancialProfile,
  scenario: HousingScenario,
  options: AffordabilityOptions = {},
): AffordabilityResult {
  // Existing helpers validate the financial history and housing inputs.
  const housingPayments = buildHousingSchedule(scenario);
  const baselineValidation = predictBaselineSpending(profile, 1);
  if (scenario.leaseStart <= profile.asOfDate) {
    throw new Error("This version requires a lease starting after the as-of date.");
  }

  // Forecast from tomorrow to the day before the exclusive lease end.
  // Include the pre-move period because its spending affects move-in readiness.
  const asOf = Date.parse(`${profile.asOfDate}T00:00:00.000Z`);
  const leaseEnd = Date.parse(`${scenario.leaseEnd}T00:00:00.000Z`);
  const forecastDays = Math.round((leaseEnd - asOf) / 86_400_000) - 1;
  if (forecastDays < 1 || forecastDays > 366) {
    throw new Error("This version supports a total forecast horizon of 1 to 366 days.");
  }
  const spending = options.spendingForecast
    ?? (forecastDays === 1 ? baselineValidation : predictBaselineSpending(profile, forecastDays));
  if (spending.predictions.length !== forecastDays) {
    throw new Error("Spending forecast must cover tomorrow through the final lease day.");
  }

  // Include the proposed housing estimates in every scenario, but independently
  // control whether uncertain personal cash flows enter the forecast.
  const excludedEstimatedFlows = profile.scheduledCashFlows.filter((flow) =>
    flow.certainty === "estimated" && flow.date > profile.asOfDate && flow.date < scenario.leaseEnd,
  );
  const personalFlows = options.includeEstimatedCashFlows
    ? profile.scheduledCashFlows
    : profile.scheduledCashFlows.filter((flow) => flow.certainty !== "estimated");
  const dailyBalances = forecastCashFlow(
    { ...profile, scheduledCashFlows: [...personalFlows, ...housingPayments] },
    spending,
    true,
  );

  // Describe actual threshold crossings rather than inventing a yes/no score.
  const warnings: string[] = [];
  const firstLow = dailyBalances.find((day) => day.belowSafetyBuffer);
  const firstNegative = dailyBalances.find((day) => day.projectedBalanceCents < 0);
  if (profile.availableBalanceCents < profile.safetyBufferCents) {
    warnings.push("Starting balance is already below the chosen safety buffer.");
  }
  if (firstLow) warnings.push(`Projected balance first falls below the safety buffer on ${firstLow.date}.`);
  if (firstNegative) warnings.push(`Projected balance first becomes negative on ${firstNegative.date}.`);
  if (!options.includeEstimatedCashFlows && excludedEstimatedFlows.length > 0) {
    warnings.push(`${excludedEstimatedFlows.length} estimated personal cash flows were excluded; compare a scenario including them.`);
  }

  // Carry assumptions into the result so the UI and AI can explain limitations.
  return {
    monthlyHousingCostCents: calculateMonthlyHousingCost(scenario),
    upfrontCashRequiredCents: calculateUpfrontCashRequired(scenario),
    dailyBalances,
    warnings,
    assumptions: [
      ...spending.assumptions,
      "Lease end is exclusive. Forecast includes spending before move-in and throughout the lease.",
      "All monthly housing costs are charged on the lease anniversary; partial months are charged in full.",
      "Deposit, application fees, and moving costs are charged at move-in; first month's rent is charged once.",
      "No deposit refund, automatic paycheck recurrence, or unscheduled future bills are assumed.",
      "Personal scheduled expenses must exclude costs replaced by the proposed housing scenario.",
      options.includeEstimatedCashFlows
        ? "Estimated personal cash flows are included alongside confirmed flows."
        : "Only confirmed personal cash flows are included; proposed housing costs remain estimates.",
      "Balances are end-of-day estimates; within-day payment timing is not modeled.",
    ],
  };
}
