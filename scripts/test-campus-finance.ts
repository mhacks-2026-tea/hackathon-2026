import assert from 'node:assert/strict';
import { buildCampusHousingScenario, evaluateCampusNessieAffordability } from '../src/lib/finance/connect-campus.ts';
import type { CampusHousingRequest } from '../src/lib/finance/connect-campus.ts';
import { buildHousingSchedule } from '../src/lib/finance/housing-schedule.ts';
import { calculateMonthlyHousingCost } from '../src/lib/finance/housing-costs.ts';

const input: CampusHousingRequest = {
  campusId: 'umich', name: 'Test shared apartment', leaseStart: '2026-10-04', leaseEnd: '2027-02-04',
  monthlyApartmentRentDollars: 2600, bedrooms: 2, roommates: 1,
  commute: 'bus', eligibleForStudentBusFare: true,
  monthlyParkingCents: 0, securityDepositCents: 130000, applicationFeesCents: 5000, movingCostsCents: 10000,
};
const built = await buildCampusHousingScenario(input);
assert.equal(built.scenario.monthlyRentCents, 130000);
assert.equal(built.scenario.monthlyInternetCents, 3250);
assert.equal(built.scenario.monthlyInsuranceCents, 1000);
assert.equal(built.scenario.monthlyUtilitiesByMonthCents?.['01'], 18250);
assert.equal(calculateMonthlyHousingCost(built.scenario, '01'), 152500);
// Groceries remain outside housing: the campus January total also includes $385.50.
assert.equal(built.campusEstimates['01'].total.expected, 1910.5);
const monthly = buildHousingSchedule(built.scenario).filter(x => x.id.startsWith('housing:monthly'));
assert.equal(monthly.length, 4);
for (const payment of monthly) {
  const month = payment.date.slice(5, 7);
  assert.equal(payment.amountCents, 134250 + Math.round(built.campusEstimates[month].items.utilities.expected * 100));
}
assert.notEqual(built.scenario.monthlyUtilitiesByMonthCents?.['07'], built.scenario.monthlyUtilitiesByMonthCents?.['01']);
const single = await buildCampusHousingScenario({ ...input, roommates: 0 });
assert.equal(single.scenario.monthlyRentCents, 260000);
assert.equal(single.scenario.monthlyInsuranceCents, 1000);
for (const bad of [
  { ...input, eligibleForStudentBusFare: false },
  { ...input, roommates: 2 },
  { ...input, campusId: '../umich' },
  { ...input, securityDepositCents: undefined },
  { ...input, monthlyParkingCents: -1 },
  { ...input, leaseStart: '2026-02-30' },
]) await assert.rejects(buildCampusHousingScenario(bad as CampusHousingRequest));
assert.throws(() => calculateMonthlyHousingCost({ ...built.scenario, monthlyUtilitiesByMonthCents: { '01': 100 } }));
let fetched = false;
const result = await evaluateCampusNessieAffordability(async () => {
  fetched = true;
  return { accountType: 'Checking', balance: 10000, purchases: [], deposits: [], bills: [] };
}, {
  customerId: 'fixture', housing: input,
  financialContext: { asOfDate: '2026-10-03', historyStartDate: '2026-10-01', safetyBufferCents: 50000 },
});
assert.ok(fetched);
assert.equal(result.affordability.monthlyHousingCostCents, calculateMonthlyHousingCost(built.scenario));
assert.ok(result.affordability.assumptions.some(x => x.includes('groceries are excluded')));
assert.equal(result.campusEstimates['01'].data_status, 'placeholder');
console.log('PASS campus-finance: TypeScript campus helpers, dollars/cents, sharing, seasonal payments, no duplicate groceries, explicit costs, validation, and combined evaluation');
