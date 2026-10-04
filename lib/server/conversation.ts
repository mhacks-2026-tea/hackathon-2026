import { randomUUID } from 'node:crypto';
import type { ApartmentFacts, Extraction } from './asi-extraction';
import { extractApartmentFacts } from './asi-extraction';
import { buildCampusHousingScenario } from '../../src/lib/finance/connect-campus';
import type { CampusHousingRequest } from '../../src/lib/finance/connect-campus';
import { runFinanceAgent } from '../../src/lib/finance/agent';
import { financialContext, InputError, presentScenario } from './movin';
import type { CampusId } from '../frontend/campus-types';
import type { HousingQuery } from '../types';

export interface ChatState { id: string; campus: CampusId; known: ApartmentFacts }
const labels: Record<string, string> = {
  leaseStart: 'lease start date with year', leaseEnd: 'lease end date with year', bedrooms: 'bedroom count',
  commute: 'walk, bike, or bus', monthlyParkingCents: 'your monthly parking cost', securityDepositCents: 'your deposit',
  applicationFeesCents: 'your application fees', movingCostsCents: 'your moving costs', safetyBufferCents: 'your minimum safety balance',
};
export async function respondToChat(
  campus: CampusId, query: HousingQuery, question: string, saved?: ChatState,
  extract: (text: string, known: ApartmentFacts) => Promise<Extraction> = extractApartmentFacts,
) {
  if (typeof question !== 'string' || !question.trim() || question.length > 8000) throw new InputError('Enter a question of 1 to 8,000 characters.');
  const state: ChatState = saved?.campus === campus ? { ...saved, known: { ...saved.known } } : {
    id: randomUUID(), campus, known: { campusId: campus === 'michigan' ? 'umich' : undefined,
      monthlyApartmentRentDollars: query.monthlyRent, roommates: query.roommates,
      ...(query.leaseStart ? { leaseStart: query.leaseStart } : {}),
      ...(query.parking === undefined ? {} : { monthlyParkingCents: Math.round(query.parking * 100) }),
    },
  };
  const reply = (content: string, extra: { scenario?: import('../types').HousingScenario; missingFields?: string[]; assumptions?: string[]; dataWarnings?: string[] } = {}) => ({
    reply: { id: `assistant-${randomUUID()}`, role: 'assistant', createdAt: 'Now', content, mode: 'asi', conversationId: state.id, ...extra }, state,
  });
  if (/^(reset|start over)$/i.test(question.trim())) {
    state.known = { campusId: campus === 'michigan' ? 'umich' : undefined };
    return reply('Started over. What is the whole-apartment rent and how many other roommates?');
  }
  if (campus !== 'michigan') return reply('The connected campus agent currently supports University of Michigan. Select Michigan to use verified campus helpers; other campuses have sample estimates only.');
  const details = /^(details|assumptions|show details|show assumptions)$/i.test(question.trim());
  const parsed = details ? { intent: 'affordability' as const, patch: {} } : await extract(question, state.known);
  if (parsed.intent === 'unknown') return reply('Ask about apartment affordability, spending, or your financial summary. Your earlier apartment details are saved.');
  Object.assign(state.known, parsed.patch);
  const known = state.known;
  if (parsed.intent === 'affordability') {
    const missing = ['monthlyApartmentRentDollars', 'roommates', ...Object.keys(labels)].filter(k => known[k as keyof ApartmentFacts] === undefined);
    if (known.commute === 'bus' && known.eligibleForStudentBusFare !== true) missing.push('eligibleForStudentBusFare');
    if (missing.length) return reply('I’m using your selected rent and roommates plus the details you provide. I still need: ' + missing.slice(0, 4).map(k => labels[k] || (k === 'eligibleForStudentBusFare' ? 'confirmation of eligible student bus fare, or choose walking/biking' : k)).join('; ') + '. State $0 explicitly for costs that do not apply.', { missingFields: missing });
  }
  const context = await financialContext();
  const profile = { ...context.profile, ...(known.safetyBufferCents === undefined ? {} : { safetyBufferCents: known.safetyBufferCents }) };
  if (parsed.intent !== 'affordability') {
    const agent = await runFinanceAgent({ question, profile }, async () => parsed);
    return reply(agent.message, { assumptions: agent.assumptions });
  }
  let built;
  try { built = await buildCampusHousingScenario({ ...known, name: 'Apartment from ASI conversation' } as CampusHousingRequest); }
  catch { throw new InputError('Check lease dates, bedrooms, sharing, and costs. Campus sharing supports zero or one roommate; all costs must be explicit.'); }
  const agent = await runFinanceAgent({ question, profile, housing: built.scenario }, async () => parsed);
  const scenario = presentScenario(profile, built.scenario, {
    monthlyRent: known.monthlyApartmentRentDollars!, roommates: known.roommates!, leaseStart: known.leaseStart,
    parking: known.monthlyParkingCents! / 100,
  });
  return reply(agent.message + (details ? '\n' + [...built.assumptions, ...context.notices].join('\n') : ''), {
    scenario, assumptions: [...agent.assumptions, ...built.assumptions], dataWarnings: context.notices,
  });
}
