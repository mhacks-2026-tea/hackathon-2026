import assert from 'node:assert/strict';

/** Run against npm start or npm run dev. Exercises actual Next server endpoints. */
const url = `${process.env.MOVIN_TEST_URL ?? 'http://127.0.0.1:3000'}/api/movin`;
for (const campus of ['michigan', 'wisconsin', 'michigan-state', 'yale', 'howard']) {
  const response = await fetch(`${url}?campus=${campus}`);
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.campus.id, campus);
  assert.ok(data.notices.length);
  assert.equal(data.scenarios.length, 3);
  assert.ok(data.cashFlow.length);
}
async function post(body: unknown) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
const query = { monthlyRent: 1234, roommates: 1, utilities: 200, parking: 45 };
const result = await post({ campus: 'michigan', query });
assert.equal(result.status, 200);
assert.equal(result.data.result.breakdown.rent, 617);
assert.equal(result.data.result.breakdown.utilities, 100);
assert.equal(result.data.result.breakdown.parking, 45);
assert.equal(result.data.query.monthlyRent, 1234);
assert.equal(result.data.comparisons[0].monthlyRent, 1234);
assert.equal(result.data.comparisons[1].roommates, 1);
assert.ok(result.data.result.upfrontCashRequired > 617);
assert.ok(result.data.cashFlow.some((p: { projectedBalance: number }) => Number.isFinite(p.projectedBalance)));
const chat = await post({ action: 'ask', campus: 'michigan', query, question: 'What if I get a roommate?' });
assert.equal(chat.status, 200);
assert.ok(chat.data.content.includes('University of Michigan'));
assert.equal(chat.data.scenario.query.monthlyRent, 1234);
assert.equal(chat.data.scenario.query.roommates, 1);
assert.equal((await post({ campus: 'michigan', query: { monthlyRent: -1, roommates: 0 } })).status, 422);
assert.equal((await post({ campus: '../data', query })).status, 422);
console.log('PASS Movin: five campuses, arbitrary rent, sharing, custom costs, comparisons, cash flow, upfront costs, chat context, validation.');
