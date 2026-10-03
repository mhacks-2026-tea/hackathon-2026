import type { FinancialProfile, HousingScenario, Transaction } from "../src/lib/finance/types.ts";
import { evaluateAffordability } from "../src/lib/finance/affordability.ts";

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

// Show month-end balances instead of printing hundreds of daily entries.
const monthEnds = result.dailyBalances.filter((day, index, days) =>
  index === days.length - 1 || day.date.slice(0, 7) !== days[index + 1].date.slice(0, 7),
);
console.table(monthEnds.map((day) => ({
  date: day.date,
  balance: dollars(day.projectedBalanceCents),
  belowBuffer: day.belowSafetyBuffer,
})));

// Daily warnings can reveal gaps that a month-end table hides.
console.log("Warnings:");
for (const warning of result.warnings) console.log(`- ${warning}`);
if (result.warnings.length === 0) console.log("- No threshold warnings under these assumptions.");
console.log("Assumptions:");
for (const assumption of result.assumptions) console.log(`- ${assumption}`);
