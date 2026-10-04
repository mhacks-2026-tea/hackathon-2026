import assert from 'node:assert/strict';
import { getCustomer, getAccounts, getPurchases, getDeposits, getBills, getLoans, getStudentFinancialData, selectStudentAccount, NessieError } from '../lib/nessie.js';

const customerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const accountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const itemId = 'cccccccccccccccccccccccc';
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let routes: Record<string, unknown> = {};
const calls: string[] = [];
process.env.NESSIE_API_KEY = 'test-key';
process.env.NESSIE_BASE_URL = 'https://nessie.example';
globalThis.fetch = async (input) => {
  const url = new URL(String(input));
  assert.equal(url.searchParams.get('key'), 'test-key');
  calls.push(url.pathname);
  assert.ok(url.pathname in routes, `Unexpected request: ${url.pathname}`);
  return Response.json(routes[url.pathname]);
};

try {
  routes = { [`/customers/${customerId}`]: { _id: customerId, first_name: 'Student', last_name: 'Example' } };
  assert.deepEqual(await getCustomer(customerId), { id: customerId, firstName: 'Student', lastName: 'Example' });
  await assert.rejects(getCustomer('bad-id'), (e: unknown) => e instanceof NessieError && e.code === 'INVALID_ID');
  console.log('PASS getCustomer: normalized response and invalid ID');
  routes = { [`/customers/${customerId}/accounts`]: [{ _id: accountId, customer_id: customerId, type: 'Checking', balance: 1250 }] };
  assert.deepEqual(await getAccounts(customerId), [{ id: accountId, customerId, type: 'Checking', nickname: '', balance: 1250 }]);
  routes[`/customers/${customerId}/accounts`] = [];
  assert.deepEqual(await getAccounts(customerId), []);
  console.log('PASS getAccounts: normalized response and empty list');
  routes = {
    [`/accounts/${accountId}/purchases`]: [{ _id: itemId, merchant_id: itemId, amount: 12.5, purchase_date: '2026-10-03' }],
    [`/merchants/${itemId}`]: { _id: itemId, name: 'Campus Cafe' },
  };
  assert.deepEqual(await getPurchases(accountId), [{ id: itemId, merchantId: itemId, merchant: 'Campus Cafe', amount: 12.5, date: '2026-10-03', status: null }]);
  routes[`/merchants/${itemId}`] = {};
  assert.equal((await getPurchases(accountId))[0].merchant, 'Unknown merchant');
  routes[`/accounts/${accountId}/purchases`] = [];
  assert.deepEqual(await getPurchases(accountId), []);
  console.log('PASS getPurchases: merchant lookup, fallback, and empty list');
  routes = { [`/accounts/${accountId}/deposits`]: [{ _id: itemId, amount: 400, transaction_date: '2026-10-01' }, { _id: accountId, amount: 'bad', transaction_date: '2026-02-30' }] };
  assert.deepEqual(await getDeposits(accountId), [
    { id: itemId, amount: 400, date: '2026-10-01', status: null },
    { id: accountId, amount: null, date: null, status: null },
  ]);
  routes[`/accounts/${accountId}/deposits`] = [];
  assert.deepEqual(await getDeposits(accountId), []);
  console.log('PASS getDeposits: transaction dates, invalid fields, and empty list');
  routes = { [`/accounts/${accountId}/bills`]: [{ _id: itemId, payee: 'Housing', payment_amount: 600, upcoming_payment_date: '2026-11-01', payment_date: '2026-10-01', recurring_date: 1 }] };
  assert.deepEqual(await getBills(accountId), [{ id: itemId, payee: 'Housing', amount: 600, date: '2026-11-01', recurringDay: 1, status: null }]);
  routes[`/accounts/${accountId}/bills`] = [{ _id: itemId, creation_date: '2026-10-01', recurring_date: 0 }];
  assert.deepEqual(await getBills(accountId), [{ id: itemId, payee: 'Unknown payee', amount: null, date: null, recurringDay: null, status: null }]);
  routes[`/accounts/${accountId}/bills`] = [];
  assert.deepEqual(await getBills(accountId), []);
  console.log('PASS getBills: upcoming payment date, missing fields, and empty list');
  routes = { [`/accounts/${accountId}/loans`]: [{ _id: itemId, amount: 2000, type: 'student', status: 'pending' }, { _id: accountId }] };
  assert.deepEqual(await getLoans(accountId), [
    { id: itemId, amount: 2000, type: 'student', status: 'pending' },
    { id: accountId, amount: null, type: null, status: null },
  ]);
  routes[`/accounts/${accountId}/loans`] = [];
  assert.deepEqual(await getLoans(accountId), []);
  console.log('PASS getLoans: normalization, missing fields, and empty list');
  routes = {
    [`/customers/${customerId}/accounts`]: [
      { _id: itemId, customer_id: customerId, type: 'Credit Card', balance: 3000 },
      { _id: accountId, customer_id: customerId, type: 'Checking', balance: 1250 },
    ],
    [`/accounts/${accountId}/purchases`]: [{ _id: itemId, merchant_id: itemId, amount: 12.5, purchase_date: '2026-10-03', status: 'executed' }],
    [`/merchants/${itemId}`]: { name: 'Campus Cafe' },
    [`/accounts/${accountId}/deposits`]: [{ _id: itemId, amount: 400, transaction_date: '2026-10-01' }],
    [`/accounts/${accountId}/bills`]: [{ _id: itemId, payee: 'Housing', payment_amount: 600, upcoming_payment_date: '2026-11-01' }],
    [`/accounts/${accountId}/loans`]: [{ _id: itemId, amount: 2000 }],
  };
  const data = await getStudentFinancialData(customerId);
  assert.deepEqual(data, {
    customerId, accountId, accountType: 'Checking', balance: 1250,
    purchases: [{ id: itemId, merchantId: itemId, merchant: 'Campus Cafe', amount: 12.5, date: '2026-10-03', status: 'executed' }],
    deposits: [{ id: itemId, amount: 400, date: '2026-10-01', status: null }],
    bills: [{ id: itemId, payee: 'Housing', amount: 600, date: '2026-11-01', recurringDay: null, status: null }],
    loans: [{ id: itemId, amount: 2000, type: null, status: null }],
  });
  console.log('PASS aggregator; normalized fixture:', JSON.stringify(data, null, 2));
  for (const resource of ['purchases', 'deposits', 'bills', 'loans']) routes[`/accounts/${accountId}/${resource}`] = [];
  const empty = await getStudentFinancialData(customerId);
  assert.deepEqual([empty.purchases, empty.deposits, empty.bills, empty.loans], [[], [], [], []]);
  const accounts = await getAccounts(customerId);
  assert.throws(() => selectStudentAccount(accounts, itemId), (e: unknown) => e instanceof NessieError && e.code === 'NO_RELEVANT_ACCOUNT');
  const savings = { ...accounts[1], type: 'Savings' };
  assert.equal(selectStudentAccount([accounts[0], savings]).id, accountId);
  assert.equal(selectStudentAccount([savings], accountId).id, accountId);
  routes[`/customers/${customerId}/accounts`] = [];
  await assert.rejects(getStudentFinancialData(customerId), (e: unknown) => e instanceof NessieError && e.code === 'NO_ACCOUNTS');
  routes[`/customers/${customerId}/accounts`] = [{ _id: accountId, customer_id: itemId }];
  await assert.rejects(getAccounts(customerId), (e: unknown) => e instanceof NessieError && e.code === 'INVALID_RESPONSE');
  const expectCode = (code: string) => (e: unknown) => e instanceof NessieError && e.code === code;
  delete process.env.NESSIE_API_KEY;
  await assert.rejects(getCustomer(customerId), expectCode('MISSING_API_KEY'));
  process.env.NESSIE_API_KEY = 'test-key';
  process.env.NESSIE_BASE_URL = 'http://insecure.example';
  await assert.rejects(getCustomer(customerId), expectCode('INVALID_CONFIG'));
  process.env.NESSIE_BASE_URL = 'https://nessie.example';
  for (const status of [401, 403, 404, 429, 500]) {
    globalThis.fetch = async () => new Response('test-key', { status });
    await assert.rejects(getCustomer(customerId), (e: unknown) => e instanceof NessieError && e.status === status && !e.message.includes('test-key'));
  }
  globalThis.fetch = async () => { throw new Error('URL contains test-key'); };
  await assert.rejects(getCustomer(customerId), (e: unknown) => e instanceof NessieError && e.code === 'NETWORK_ERROR' && !e.message.includes('test-key'));
  globalThis.fetch = async () => new Response('not JSON');
  await assert.rejects(getCustomer(customerId), expectCode('INVALID_RESPONSE'));
  globalThis.fetch = async () => Response.json({ message: 'unexpected envelope' });
  await assert.rejects(getLoans(accountId), expectCode('INVALID_RESPONSE'));
  globalThis.fetch = async () => Response.json([{}]);
  await assert.rejects(getLoans(accountId), expectCode('INVALID_RESPONSE'));
  for (const fn of [getAccounts, getPurchases, getDeposits, getBills, getLoans]) {
    await assert.rejects(fn('bad-id'), expectCode('INVALID_ID'));
  }
  // The aggregator must reject on resource failure rather than return partial data.
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/accounts')) return Response.json([{ _id: accountId, customer_id: customerId, type: 'Checking' }]);
    if (path.endsWith('/deposits')) return new Response(null, { status: 503 });
    return Response.json([]);
  };
  await assert.rejects(getStudentFinancialData(customerId), expectCode('API_ERROR'));
  console.log('PASS empty aggregation, account selection, API/network/config/JSON errors, and key redaction');
} finally {
  globalThis.fetch = originalFetch;
  process.env = originalEnv;
}
