import type { FinancialProfile, HousingScenario, Transaction } from "../src/lib/finance/types.ts";
import { evaluateAffordability } from "../src/lib/finance/affordability.ts";
import { simulateAffordability } from "../src/lib/finance/simulation.ts";

/**
 * Run from the repo root with Node 24:
 * node scripts/demo-affordability.ts
 * All financial inputs are fictional, not Nessie data or campus benchmarks.
 */

// Four weekly purchases total $280 over 28 observed days: $10/day on average.
const transactions: Transaction[] = [6, 13, 20, 27].map((day, index) => ({
  id: `demo-groceries-${index}`,
  date: `2026-07-${String(day).padStart(2, "0")}`,
  amountCents: 7000,
  direction: "expense",
  category: "groceries",
  description: "Fictional weekly groceries",
  spendingType: "variable",
}));

// Income is explicitly scheduled through May; no summer pay is assumed.
const schoolYearPayDates = [
  "2026-08-15", "2026-09-15", "2026-10-15", "2026-11-15", "2026-12-15",
  "2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15", "2027-05-15",
];
const student: FinancialProfile = {
  asOfDate: "2026-07-31",
  historyStartDate: "2026-07-04",
  availableBalanceCents: 300000,
  safetyBufferCents: 50000,
  transactions,
  scheduledCashFlows: schoolYearPayDates.map((date, index) => ({
    id: `demo-paycheck-${index}`,
    label: "Fictional expected monthly income",
    date,
    amountCents: 180000,
    direction: "income",
    certainty: "estimated",
  })),
};

// A twelve-month lease needs twelve months of housing payments, even though
// this student expects income for only ten months. Every amount is their share.
const apartment: HousingScenario = {
  name: "Fictional apartment",
  leaseStart: "2026-08-01",
  leaseEnd: "2027-08-01",
  monthlyRentCents: 105000,
  monthlyUtilitiesCents: 10000,
  monthlyInternetCents: 3000,
  monthlyInsuranceCents: 1500,
  monthlyParkingCents: 0,
  monthlyCommuteCents: 0,
  securityDepositCents: 105000,
  applicationFeesCents: 5000,
  movingCostsCents: 15000,
};

// Explicitly include expected income for this illustrative scenario.
const result = evaluateAffordability(student, apartment, {
  includeEstimatedCashFlows: true,
});

// Convert cents to dollars only for display; calculations stay in cents.
const dollars = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

console.log("MOVIN DEMO — fictional data, baseline forecast, no trained ML yet");
console.log(`Monthly housing cost: ${dollars(result.monthlyHousingCostCents)}`);
console.log(`Move-in cash (rent, deposit, fees, moving): ${dollars(result.upfrontCashRequiredCents)}`);
console.log(`Chosen safety buffer: ${dollars(student.safetyBufferCents)}`);

// Group daily balances by month so a paycheck cannot hide earlier cash gaps.
const monthlyBalances = new Map<string, {
  endingBalanceCents: number;
  lowestBalanceCents: number;
  lowestBalanceDate: string;
  daysBelowBuffer: number;
}>();
for (const day of result.dailyBalances) {
  const month = day.date.slice(0, 7);
  const summary = monthlyBalances.get(month) ?? {
    endingBalanceCents: day.projectedBalanceCents,
    lowestBalanceCents: day.projectedBalanceCents,
    lowestBalanceDate: day.date,
    daysBelowBuffer: 0,
  };
  // Days arrive in order, so the final assignment is the month's ending balance.
  summary.endingBalanceCents = day.projectedBalanceCents;
  if (day.projectedBalanceCents < summary.lowestBalanceCents) {
    summary.lowestBalanceCents = day.projectedBalanceCents;
    summary.lowestBalanceDate = day.date;
  }
  if (day.belowSafetyBuffer) summary.daysBelowBuffer += 1;
  monthlyBalances.set(month, summary);
}

// "Dipped below buffer" describes any day in the month, not just its last day.
console.table([...monthlyBalances].map(([month, summary]) => ({
  month,
  endingBalance: dollars(summary.endingBalanceCents),
  lowestBalance: dollars(summary.lowestBalanceCents),
  lowestOn: summary.lowestBalanceDate,
  dippedBelowBuffer: summary.daysBelowBuffer > 0,
  daysBelowBuffer: summary.daysBelowBuffer,
})));

// Daily warnings can reveal gaps that a month-end table hides.
console.log("Warnings:");
for (const warning of result.warnings) console.log(`- ${warning}`);
if (result.warnings.length === 0) console.log("- No threshold warnings under these assumptions.");
console.log("Assumptions:");
for (const assumption of result.assumptions) console.log(`- ${assumption}`);

// Test persistently higher/lower spending while keeping expected pay dates fixed.
// The seed makes this demo repeatable; the 20% variation is an assumption,
// not an uncertainty level learned from the student's history.
const simulation = simulateAffordability(student, apartment, {
  scenarioCount: 500,
  seed: 42,
  spendingVariationFraction: 0.2,
  includeEstimatedCashFlows: true,
});

// Report the fraction as modeled scenarios, not a real-world probability.
const percentage = (simulation.fractionBelowSafetyBuffer * 100).toFixed(1);
console.log("\nSPENDING SENSITIVITY SIMULATION");
console.log(`${percentage}% of ${simulation.scenarioCount} modeled scenarios fall below the ${dollars(student.safetyBufferCents)} buffer.`);
console.log("Each scenario assumes spending stays between 80% and 120% of the baseline for the full forecast.");
console.log("Income dates and amounts remain fixed, including the assumed summer income gap.");
console.log("This is a sensitivity test, not a trained ML prediction or a calibrated probability.");

// Compare a second fictional listing. Costs are explicit, not inferred from
// adding a roommate: only rent and deposit change in this example.
const cheaperApartment: HousingScenario = {
  ...apartment,
  name: "Fictional cheaper apartment",
  monthlyRentCents: 75000,
  securityDepositCents: 75000,
};
const cheaperResult = evaluateAffordability(student, cheaperApartment, {
  includeEstimatedCashFlows: true,
});

// Use the same seed and spending assumptions for an apples-to-apples comparison.
const cheaperSimulation = simulateAffordability(student, cheaperApartment, {
  scenarioCount: 500,
  seed: 42,
  spendingVariationFraction: 0.2,
  includeEstimatedCashFlows: true,
});

// Summarize both full daily timelines, not just their month-end balances.
console.log("\nAPARTMENT COMPARISON — fictional listings");
console.table([
  { housing: apartment, affordability: result, risk: simulation },
  { housing: cheaperApartment, affordability: cheaperResult, risk: cheaperSimulation },
].map(({ housing, affordability, risk }) => {
  const lowest = affordability.dailyBalances.reduce((minimum, day) =>
    day.projectedBalanceCents < minimum.projectedBalanceCents ? day : minimum,
  );
  return {
    apartment: housing.name,
    monthlyHousing: dollars(affordability.monthlyHousingCostCents),
    moveInCash: dollars(affordability.upfrontCashRequiredCents),
    lowestBalance: dollars(lowest.projectedBalanceCents),
    lowestOn: lowest.date,
    daysBelowBuffer: affordability.dailyBalances.filter((day) => day.belowSafetyBuffer).length,
    scenariosBelowBuffer: `${(risk.fractionBelowSafetyBuffer * 100).toFixed(1)}%`,
  };
}));
console.log("Only rent and deposit differ. Utilities, income, everyday spending, and lease dates are unchanged.");
console.log("Scenario percentages describe spending sensitivity, not real-world probabilities.");
