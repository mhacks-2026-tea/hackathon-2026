import { getStudentFinancialData } from "../lib/nessie.js";
import { evaluateCampusNessieAffordability } from "../src/lib/finance/connect-campus.ts";

/**
 * Read-only integration demo using the team's October 2026 sandbox fixture.
 * Run: node --env-file=.env.local --import tsx scripts/demo-campus-nessie.ts
 * Rent and move-in costs are hypothetical; recurring estimates use the campus helpers.
 */
const customerId = process.env.NESSIE_CUSTOMER_ID?.trim();
const accountId = process.env.NESSIE_ACCOUNT_ID?.trim() || undefined;
const historyStartDate = process.env.FINANCE_HISTORY_START?.trim();
if (!customerId || !historyStartDate) {
  throw new Error("Configure NESSIE_CUSTOMER_ID and FINANCE_HISTORY_START in .env.local.");
}

// Fetch once, then reuse this snapshot throughout the calculation.
const bankingData = await getStudentFinancialData(customerId, accountId);

// This fixture's existing October rent is explicitly replaced by the proposal.
// Fail if the fixture changes; do not silently classify an unrelated bill as rent.
const rentBills = bankingData.bills.filter((bill) =>
  bill.payee === "Demo Student Housing" && bill.date === "2026-10-10",
);
if (rentBills.length !== 1) {
  throw new Error("Expected one Demo Student Housing bill dated October 10; review the demo fixture before continuing.");
}

const { affordability, dataWarnings } = await evaluateCampusNessieAffordability(
  async () => bankingData,
  {
    customerId,
    accountId,
    financialContext: {
      // Fixed to the fixture snapshot, not today's date on future demo runs.
      asOfDate: "2026-10-03",
      historyStartDate,
      safetyBufferCents: 50000,
      excludedBillIds: rentBills.map((bill) => bill.id),
    },
    housing: {
      campusId: "umich",
      name: "Demo shared UMich apartment",
      leaseStart: "2026-10-04",
      leaseEnd: "2027-02-04",
      monthlyApartmentRentDollars: 2600,
      bedrooms: 2,
      roommates: 1,
      commute: "bus",
      eligibleForStudentBusFare: true, // Explicit fictional demo eligibility.
      monthlyParkingCents: 0, // Explicit no-parking demo choice.
      securityDepositCents: 130000,
      applicationFeesCents: 5000,
      movingCostsCents: 15000,
    },
  },
);

// Show aggregate results only; never print credentials or account identifiers.
const dollars = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const firstDay = affordability.dailyBalances[0];
const lastDay = affordability.dailyBalances.at(-1)!;
console.log("LIVE NESSIE + CAMPUS ESTIMATES — October 3, 2026 snapshot");
console.log(`Lease-start monthly housing costs: ${dollars(affordability.monthlyHousingCostCents)}`);
console.log(`Move-in cash: ${dollars(affordability.upfrontCashRequiredCents)}`);
console.log(`Projected balance after first day (${firstDay.date}): ${dollars(firstDay.projectedBalanceCents)}`);
console.log(`Projected balance at end (${lastDay.date}): ${dollars(lastDay.projectedBalanceCents)}`);
console.log("Existing October rent is replaced; the October phone bill remains scheduled.");
console.log("No future paycheck is assumed from the historical deposit. Four months are modeled with seasonal utilities.");
console.log("Forecast is provisional: only three days of demo history are available.");
for (const warning of [...dataWarnings, ...affordability.warnings]) console.log(`- ${warning}`);
