import type { HousingScenario, ISODate, ScheduledCashFlow } from "./types.ts";
import { calculateMonthlyHousingCost, calculateUpfrontCashRequired } from "./housing-costs.ts";

/** Return a valid UTC calendar date, rejecting impossible dates. */
function parseDate(date: ISODate): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime())
    || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return parsed;
}

/**
 * Build modeled housing payments for a proposed lease.
 * leaseEnd is exclusive: Aug 1 to next Aug 1 produces 12 payments.
 * Monthly costs are grouped on the lease anniversary for this first version.
 * Partial months are charged in full; actual proration is not modeled yet.
 * Returned estimates require includeEstimatedCashFlows=true in cash-flow.ts.
 */
export function buildHousingSchedule(scenario: HousingScenario): ScheduledCashFlow[] {
  const start = parseDate(scenario.leaseStart);
  const end = parseDate(scenario.leaseEnd);
  if (end <= start) throw new Error("Lease end must be after lease start.");

  // Reuse existing calculators to validate all monetary inputs.
  const monthlyCost = calculateMonthlyHousingCost(scenario);
  const upfrontCash = calculateUpfrontCashRequired(scenario);
  // Rent belongs to the first monthly payment, so remove it from this entry.
  const oneTimeCost = upfrontCash - scenario.monthlyRentCents;
  const payments: ScheduledCashFlow[] = [];
  if (oneTimeCost > 0) {
    payments.push({
      id: `housing:move-in:${scenario.leaseStart}`,
      label: `${scenario.name}: deposit, application fees, and moving costs`,
      date: scenario.leaseStart,
      amountCents: oneTimeCost,
      direction: "expense",
      certainty: "estimated",
    });
  }

  // Preserve the original day across months. For a Jan 31 start, February
  // uses its last day, and March returns to the 31st rather than drifting.
  const anniversaryDay = start.getUTCDate();
  for (let offset = 0; ; offset += 1) {
    const firstDay = new Date(start.getTime());
    firstDay.setUTCDate(1);
    firstDay.setUTCMonth(start.getUTCMonth() + offset);
    const lastDay = new Date(firstDay.getTime());
    lastDay.setUTCMonth(lastDay.getUTCMonth() + 1);
    lastDay.setUTCDate(0);
    firstDay.setUTCDate(Math.min(anniversaryDay, lastDay.getUTCDate()));
    if (firstDay >= end) break;
    payments.push({
      id: `housing:monthly:${firstDay.toISOString().slice(0, 10)}`,
      label: `${scenario.name}: monthly housing costs`,
      date: firstDay.toISOString().slice(0, 10),
      amountCents: monthlyCost,
      direction: "expense",
      certainty: "estimated",
    });
  }

  // Deposit refunds are not assumed: their date and amount are unknown.
  return payments;
}
