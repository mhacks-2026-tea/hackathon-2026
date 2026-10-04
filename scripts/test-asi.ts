import assert from 'node:assert/strict';
import { webQuestionInterpreter } from '../lib/server/asi.ts';
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
