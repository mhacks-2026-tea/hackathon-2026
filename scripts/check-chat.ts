import assert from 'node:assert/strict';
import { POST } from '../app/api/movin/route';
// Test the real ASI account through the web route, using a fictional financial profile.
process.env.MOVIN_DATA_MODE = 'demo';
assert.ok(process.env.ASI1_API_KEY, 'Configure ASI1_API_KEY in .env.local');
function request(question: string, cookie?: string) {
  return new Request('https://demo.example/api/movin', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ action: 'ask', campus: 'michigan', query: { monthlyRent: 1300, roommates: 0 }, question }) });
}
const first = await POST(request('Can I afford this apartment?'));
const initial = await first.json();
assert.equal(first.status, 200, initial.error);
assert.ok(initial.missingFields?.length);
const cookie = first.headers.get('set-cookie')!.split(';')[0];
const second = await POST(request('One bedroom, walking, lease May 1 2026 to June 1 2026. My parking, deposit, application fees and moving costs are all zero dollars. Keep a 500 dollar safety buffer.', cookie));
const result = await second.json();
assert.equal(second.status, 200, result.error);
assert.equal(result.conversationId, initial.conversationId);
assert.ok(result.scenario, 'Expected completed apartment details to produce a finance evaluation');
console.log('PASS live ASI multi-turn website route, retained session, and actual finance evaluation using a fictional demo profile.');
