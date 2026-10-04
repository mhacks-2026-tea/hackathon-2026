import assert from "node:assert/strict";
import type { FinancialProfile, HousingScenario } from "../src/lib/finance/types.ts";
import { calculateMonthlyHousingCost, calculateUpfrontCashRequired } from "../src/lib/finance/housing-costs.ts";
import { summarizeFinances } from "../src/lib/finance/financial-summary.ts";
import { predictBaselineSpending } from "../src/lib/finance/spending-baseline.ts";
import { buildHousingSchedule } from "../src/lib/finance/housing-schedule.ts";
import { forecastCashFlow } from "../src/lib/finance/cash-flow.ts";
import { evaluateAffordability } from "../src/lib/finance/affordability.ts";
import { simulateAffordability } from "../src/lib/finance/simulation.ts";

/** Run with Node 24: node scripts/test-finance.ts. All inputs are fictional. */
const student: FinancialProfile = {
  asOfDate: "2026-07-31",
  historyStartDate: "2026-07-04",
  availableBalanceCents: 300000,
  safetyBufferCents: 50000,
  transactions: [{
    id: "food", date: "2026-07-10", amountCents: 28000,
    direction: "expense", category: "food", description: "Test groceries",
    spendingType: "variable",
  }],
  scheduledCashFlows: [{
    id: "pay", label: "Expected pay", date: "2026-08-15",
    amountCents: 180000, direction: "income", certainty: "estimated",
  }],
};
const apartment: HousingScenario = {
  name: "Test apartment", leaseStart: "2026-08-01", leaseEnd: "2027-08-01",
  monthlyRentCents: 105000, monthlyUtilitiesCents: 10000,
  monthlyInternetCents: 3000, monthlyInsuranceCents: 1500,
  monthlyParkingCents: 0, monthlyCommuteCents: 0,
  securityDepositCents: 105000, applicationFeesCents: 5000, movingCostsCents: 15000,
};

// Failures stop the script and identify the named behavior that regressed.
let passed = 0;
function check(name: string, test: () => void): void {
  try {
    test();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

check("Housing totals and invalid money", () => {
  assert.equal(calculateMonthlyHousingCost(apartment), 119500);
  assert.equal(calculateUpfrontCashRequired(apartment), 230000);
  assert.throws(() => calculateMonthlyHousingCost({ ...apartment, monthlyRentCents: -1 }));
  assert.throws(() => calculateUpfrontCashRequired({ ...apartment, movingCostsCents: 0.5 }));
});

check("History separates scheduled expenses and excludes future transactions", () => {
  const summary = summarizeFinances({ ...student, transactions: [
    ...student.transactions,
    { ...student.transactions[0], id: "rent", amountCents: 105000, spendingType: "scheduled" },
    { ...student.transactions[0], id: "future", date: "2026-08-01", amountCents: 99999 },
  ] });
  assert.equal(summary.months[0].expenseCents, 133000);
  assert.equal(summary.months[0].variableSpendingCents, 28000);
  assert.deepEqual(summary.variableSpendingByCategory, { food: 28000 });
});

check("History rejects impossible dates and duplicate IDs", () => {
  assert.throws(() => summarizeFinances({ ...student, asOfDate: "2026-02-30" }));
  assert.throws(() => summarizeFinances({ ...student, transactions: [
    student.transactions[0], student.transactions[0],
  ] }));
});

check("Baseline includes zero-spending days and handles an empty history", () => {
  const forecast = predictBaselineSpending(student, 2);
  assert.equal(forecast.predictions[0].predictedCents, 1000);
  assert.equal(forecast.predictions[0].date, "2026-08-01");
  assert.equal(forecast.predictions[1].date, "2026-08-02");
  assert.equal(predictBaselineSpending({ ...student, transactions: [] }).predictions[0].predictedCents, 0);
});

check("Lease schedule charges twelve months and first rent once", () => {
  const schedule = buildHousingSchedule(apartment);
  assert.equal(schedule.length, 13);
  assert.equal(schedule.at(-1)?.date, "2027-07-01");
  assert.equal(schedule.reduce((sum, flow) => sum + flow.amountCents, 0), 125000 + 12 * 119500);
});

check("Month-end lease anniversaries recover after leap-year February", () => {
  const schedule = buildHousingSchedule({ ...apartment, leaseStart: "2028-01-31", leaseEnd: "2028-04-01" });
  assert.deepEqual(schedule.slice(1).map((flow) => flow.date), ["2028-01-31", "2028-02-29", "2028-03-31"]);
});

check("Cash flow excludes uncertain income unless explicitly enabled", () => {
  const spending = predictBaselineSpending(student, 15);
  assert.equal(forecastCashFlow(student, spending).at(-1)?.projectedBalanceCents, 285000);
  assert.equal(forecastCashFlow(student, spending, true).at(-1)?.projectedBalanceCents, 465000);
  assert.throws(() => forecastCashFlow(student, { ...spending, predictions: spending.predictions.slice(1) }));
});

check("Daily warnings catch a dip hidden by a positive month-end balance", () => {
  const result = evaluateAffordability(student, apartment, { includeEstimatedCashFlows: true });
  assert.equal(result.dailyBalances.length, 365);
  assert.equal(result.dailyBalances.at(-1)?.date, "2027-07-31");
  const august = result.dailyBalances.filter((day) => day.date.startsWith("2026-08"));
  assert.equal(august[0].projectedBalanceCents, 54500);
  assert.equal(Math.min(...august.map((day) => day.projectedBalanceCents)), 41500);
  assert.equal(august.filter((day) => day.belowSafetyBuffer).length, 9);
  assert.equal(august.at(-1)?.belowSafetyBuffer, false);
  assert.ok(result.warnings.some((warning) => warning.includes("2026-08-06")));
});

check("Spending simulation is repeatable and counts a path only once", () => {
  // A one-day horizon isolates the threshold: $60 minus about $10, buffer $50.
  const profile = { ...student, availableBalanceCents: 6000, safetyBufferCents: 5000, scheduledCashFlows: [] };
  const housing = { ...apartment, leaseEnd: "2026-08-02", monthlyRentCents: 0,
    monthlyUtilitiesCents: 0, monthlyInternetCents: 0, monthlyInsuranceCents: 0,
    securityDepositCents: 0, applicationFeesCents: 0, movingCostsCents: 0 };
  const options = { scenarioCount: 100, seed: 42 };
  const result = simulateAffordability(profile, housing, options);
  assert.deepEqual(result, simulateAffordability(profile, housing, options));
  assert.ok(result.fractionBelowSafetyBuffer > 0 && result.fractionBelowSafetyBuffer < 1);
  // Equal to the buffer is allowed: the comparison is strictly below.
  assert.equal(simulateAffordability(profile, housing, { ...options, spendingVariationFraction: 0 }).fractionBelowSafetyBuffer, 0);
  assert.equal(simulateAffordability({ ...profile, availableBalanceCents: 0 }, housing, options).fractionBelowSafetyBuffer, 1);
});

console.log(`\n${passed} finance checks passed.`);
