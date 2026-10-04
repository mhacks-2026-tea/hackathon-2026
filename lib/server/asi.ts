import { createModelInterpreter, interpretFinanceQuestion, type QuestionInterpreter } from '../../src/lib/finance/agent.ts';

/** Same ASI endpoint/model as agents/fetch/conversation.py; banking data stays local. */
export function webQuestionInterpreter(): { interpret: QuestionInterpreter; mode: 'asi' | 'offline' } {
  const key = process.env.ASI1_API_KEY?.trim();
  if (!key) return { mode: 'offline', interpret: async question => {
    const result = await interpretFinanceQuestion(question);
    if (result.intent === 'unknown' && /\b(roommates?|move[- ]?in|deposit|safety (?:buffer|cushion))\b|\b(?:why|how).{0,60}\b(?:tight|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(question)) return { intent: 'affordability' };
    return result;
  } };
  return { mode: 'asi', interpret: createModelInterpreter(async prompt => {
    let response: Response;
    try {
      response = await fetch('https://api.asi1.ai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'asi1', max_tokens: 150, messages: [
          { role: 'system', content: 'Classify financial questions. Roommates, move-in savings, and tight-month questions are affordability. Gibberish, unrelated subjects, and greetings are unknown. Return only the requested JSON; never calculate or invent financial figures.' },
          { role: 'user', content: prompt },
        ] }), signal: AbortSignal.timeout(20000), cache: 'no-store',
      });
    } catch { throw new Error('ASI could not be reached. Please retry.'); }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'ASI access failed. Check the server API key.' : 'ASI is temporarily unavailable. Please retry.');
    const value = await response.json();
    const content = value?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('ASI returned an invalid question interpretation.');
    return content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }) };
}
