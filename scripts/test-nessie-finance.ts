import assert from 'node:assert/strict';
import { adaptNessieData } from '../src/lib/finance/nessie-adapter.ts';
import type { NessieAdapterInput, NessieAdapterOptions } from '../src/lib/finance/nessie-adapter.ts';
import { evaluateNessieAffordability } from '../src/lib/finance/connect-nessie.ts';
import { evaluateCampusNessieAffordability } from '../src/lib/finance/connect-campus.ts';
import type { HousingScenario } from '../src/lib/finance/types.ts';

const data: NessieAdapterInput = {
  accountType: 'Checking', balance: -25.5,
  purchases: [
    { id: 'food', merchant: 'Cafe', amount: 12.5, date: '2026-10-02', status: 'completed' },
    { id: 'scheduled', merchant: 'Utility', amount: 50, date: '2026-10-01', status: 'completed' },
    { id: 'pending', merchant: 'Shop', amount: 15, date: '2026-10-02', status: 'pending' },
    { id: 'missing', merchant: 'Shop', amount: null, date: null, status: 'completed' },
    { id: 'negative', merchant: 'Shop', amount: -10, date: '2026-10-02', status: 'completed' },
    { id: 'future', merchant: 'Shop', amount: 10, date: '2026-10-05', status: 'completed' },
  ],
  deposits: [{ id: 'pay', amount: 450, date: '2026-10-01', status: 'completed' }],
  bills: [
    { id: 'rent', payee: 'Housing', amount: 850, date: '2026-10-10', status: 'pending' },
    { id: 'phone', payee: 'Phone', amount: 45, date: '2026-10-15', status: 'pending' },
    { id: 'cancelled', payee: 'Other', amount: 20, date: '2026-10-15', status: 'cancelled' },
    { id: 'overdue', payee: 'Other', amount: 20, date: '2026-10-01', status: 'pending' },
  ],
};
const context: NessieAdapterOptions = {
  asOfDate: '2026-10-03', historyStartDate: '2026-10-01', safetyBufferCents: 50000,
  excludedBillIds: ['rent'], scheduledPurchaseIds: ['scheduled'], purchaseCategories: { food: 'groceries' },
};
const snapshot = structuredClone(data);
const adapted = adaptNessieData(data, context);
assert.deepEqual(data, snapshot);
assert.equal(adapted.profile.availableBalanceCents, -2550);
assert.equal(adapted.profile.transactions.length, 3);
assert.equal(adapted.profile.transactions[0].amountCents, 1250);
assert.equal(adapted.profile.transactions[0].category, 'groceries');
assert.equal(adapted.profile.transactions[1].spendingType, 'scheduled');
assert.deepEqual(adapted.profile.scheduledCashFlows.map(x => [x.id, x.amountCents]), [['nessie:bill:phone', 4500]]);
assert.ok(adapted.warnings.some(x => x.includes('missing or invalid')));
assert.ok(adapted.warnings.some(x => x.includes('overdue')));
assert.throws(() => adaptNessieData({ ...data, accountType: 'Credit Card' }, context));
assert.throws(() => adaptNessieData({ ...data, balance: null }, context));
assert.throws(() => adaptNessieData({ ...data, purchases: [data.purchases[0], data.purchases[0]] }, context), /Duplicate/);
assert.throws(() => adaptNessieData(data, { ...context, historyStartDate: '2026-10-04' }));
const housing: HousingScenario = {
  name: 'Test', leaseStart: '2026-10-04', leaseEnd: '2026-11-04',
  monthlyRentCents: 100000, monthlyUtilitiesCents: 0, monthlyInternetCents: 0,
  monthlyInsuranceCents: 0, monthlyParkingCents: 0, monthlyCommuteCents: 0,
  securityDepositCents: 0, applicationFeesCents: 0, movingCostsCents: 0,
};
const request = { customerId: 'customer', accountId: 'account', housing, financialContext: context };
let calls = 0;
const result = await evaluateNessieAffordability(async (customer, account) => {
  calls++; assert.equal(customer, 'customer'); assert.equal(account, 'account'); return data;
}, request);
assert.equal(calls, 1);
assert.ok(result.affordability.warnings.some(x => x.includes('Starting balance')));
// Only cafe spending contributes $12.50 / 3 observed days -> $4.17 per day.
assert.equal(result.affordability.dailyBalances[0].projectedBalanceCents, -2550 - 100000 - 417);
await assert.rejects(evaluateNessieAffordability(async () => { throw new Error('Nessie unavailable'); }, request), /Nessie unavailable/);
let fetched = false;
await assert.rejects(evaluateCampusNessieAffordability(async () => { fetched = true; return data; }, {
  ...request, housing: {
    campusId: 'umich', name: 'Test', leaseStart: housing.leaseStart, leaseEnd: housing.leaseEnd,
    monthlyApartmentRentDollars: 2600, bedrooms: 2, roommates: 1, commute: 'bus',
    monthlyParkingCents: 0, securityDepositCents: 0, applicationFeesCents: 0, movingCostsCents: 0,
  },
}), /eligible student bus/);
assert.equal(fetched, false);
console.log('PASS Nessie-finance conversion: negative balances, cents, statuses, exclusions, incomplete data, duplicates, history, forecast, and failure propagation');
