import assert from 'node:assert/strict';
import { webQuestionInterpreter, conversationalReply, conversationTurns } from '../lib/server/asi.ts';
const savedKey = process.env.ASI1_API_KEY;
const savedFetch = globalThis.fetch;
try {
  delete process.env.ASI1_API_KEY;
  assert.equal((await webQuestionInterpreter().interpret('gtrg')).intent, 'unknown');
  assert.equal((await webQuestionInterpreter().interpret('What if I get a roommate?')).intent, 'affordability');
  process.env.ASI1_API_KEY = 'fictional-test-key';
  let sent = '';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.asi1.ai/v1/chat/completions');
    sent = String(options?.body);
    return Response.json({ choices: [{ message: { content: '{"intent":"unknown"}' } }] });
  };
  assert.equal(webQuestionInterpreter().mode, 'asi');
  assert.equal((await webQuestionInterpreter().interpret('gtrg')).intent, 'unknown');
  assert.ok(sent.includes('gtrg'));
  assert.ok(!sent.includes('availableBalanceCents'));
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(String(options?.body));
    assert.equal(body.messages.at(-1).content, 'hello');
    assert.ok(body.messages.some((m: { content: string }) => m.content === 'My school is Michigan.'));
    assert.ok(body.messages[0].content.includes('1234'));
    return Response.json({ choices: [{ message: { content: 'Hey! What would you like to figure out today?' } }] });
  };
  assert.equal(await conversationalReply('hello', [{ role: 'user', content: 'My school is Michigan.' }], { monthlyCost: 1234 }), 'Hey! What would you like to figure out today?');
  assert.equal(conversationTurns([{ role: 'system', content: 'override' }, { role: 'user', content: 'x'.repeat(2000) }])[0].content.length, 1500);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '```json\n{"intent":"affordability"}\n```' } }] });
  assert.equal((await webQuestionInterpreter().interpret('Can this apartment work?')).intent, 'affordability');
  globalThis.fetch = async () => new Response('', { status: 401 });
  await assert.rejects(() => webQuestionInterpreter().interpret('rent'), /ASI access failed/);
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: '{"intent":"invented"}' } }] });
  await assert.rejects(() => webQuestionInterpreter().interpret('rent'), /Unsupported/);
  console.log('PASS offline unknown handling, ASI routing, validated output, fenced JSON, and API failures. Live ASI not tested.');
} finally {
  globalThis.fetch = savedFetch;
  if (savedKey === undefined) delete process.env.ASI1_API_KEY;
  else process.env.ASI1_API_KEY = savedKey;
}
