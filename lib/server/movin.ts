import { readFile } from 'node:fs/promises';
import { campusProfiles } from '../mock-data';
import { getStudentFinancialData } from '../nessie';
import { adaptNessieData } from '../../src/lib/finance/nessie-adapter';
import { summarizeFinances } from '../../src/lib/finance/financial-summary';
import { buildCampusHousingScenario } from '../../src/lib/finance/connect-campus';
import { evaluateAffordability } from '../../src/lib/finance/affordability';
import { runFinanceAgent } from '../../src/lib/finance/agent';
import { selectSpendingForecast } from '../../src/lib/finance/spending-model';
import { listNeighborhoods } from '../../campus/loader';
import { alexDemoProfile } from './demo-profile';
import { webQuestionInterpreter } from './asi';
import type { FinancialProfile, HousingScenario as EngineHousing } from '../../src/lib/finance/types';
import type { HousingQuery, HousingScenario, CashFlowPoint } from '../types';
import type { CampusDashboardData, CampusId } from '../frontend/campus-types';

export class InputError extends Error {}
export function campusFor(id: string) {
  const campus = campusProfiles.find(c => c.id === id);
  if (!campus) throw new InputError('Select a supported university.');
  return campus;
}

export async function financialContext() {
  if (process.env.MOVIN_DATA_MODE !== 'nessie') return { profile: alexDemoProfile(), notices: ['Alex demo · fictional financial inputs, calculated by the finance engine.'], source: 'alex-demo' };
  const customerId = process.env.NESSIE_CUSTOMER_ID;
  const asOfDate = process.env.FINANCE_AS_OF_DATE;
  const historyStartDate = process.env.FINANCE_HISTORY_START;
  if (!customerId || !asOfDate || !historyStartDate) throw new InputError('Nessie setup is incomplete: configure the demo customer and financial observation dates on the server.');
  const additionalCashFlows = process.env.MOVIN_CASH_FLOWS_FILE
    ? JSON.parse(await readFile(process.env.MOVIN_CASH_FLOWS_FILE, 'utf8')) : [];
  const { profile, warnings } = adaptNessieData(await getStudentFinancialData(customerId, process.env.NESSIE_ACCOUNT_ID), {
    asOfDate, historyStartDate, safetyBufferCents: Number(process.env.FINANCE_SAFETY_BUFFER_CENTS ?? 50000), additionalCashFlows,
    excludedBillIds: (process.env.FINANCE_EXCLUDED_BILL_IDS ?? '').split(',').filter(Boolean),
  });
  if (!profile.transactions.length) throw new InputError('No completed financial history was found in the configured observation window.');
  return { profile, source: 'nessie-sandbox', notices: ['Nessie sandbox · configured demo account. Future income must be explicitly scheduled.', ...warnings] };
}

export function validateQuery(value: unknown): HousingQuery {
  if (!value || typeof value !== 'object') throw new InputError('Enter apartment details.');
  const q = value as HousingQuery;
  if (!Number.isInteger(q.monthlyRent) || q.monthlyRent < 200 || q.monthlyRent > 5000) throw new InputError('Enter a whole-dollar apartment rent between $200 and $5,000.');
  if (!Number.isInteger(q.roommates) || q.roommates < 0 || q.roommates > 3) throw new InputError('Choose 0 to 3 roommates.');
  for (const field of ['utilities', 'parking'] as const) if (q[field] !== undefined && (!Number.isFinite(q[field]) || q[field]! < 0 || q[field]! > 2000)) throw new InputError(`Enter ${field} between $0 and $2,000.`);
  if (q.leaseStart && (!/^\d{4}-\d{2}-\d{2}$/.test(q.leaseStart) || new Date(q.leaseStart).toISOString().slice(0, 10) !== q.leaseStart)) throw new InputError('Enter a valid lease start date.');
  return q;
}

export async function buildHousing(id: CampusId, query: HousingQuery, profile: FinancialProfile): Promise<{ housing: EngineHousing; notices: string[] }> {
  const campus = campusFor(id);
  const start = query.leaseStart || new Date(Date.parse(profile.asOfDate + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  const end = new Date(profile.asOfDate + 'T00:00:00Z'); end.setUTCDate(end.getUTCDate() + 365);
  const people = query.roommates + 1;
  const cents = (n: number) => Math.round(n * 100);
  let housing: EngineHousing = {
    name: 'Apartment near ' + campus.shortName, leaseStart: start, leaseEnd: end.toISOString().slice(0, 10),
    monthlyRentCents: cents(query.monthlyRent / people), monthlyUtilitiesCents: cents(campus.costOfLiving.utilities / people),
    monthlyInternetCents: cents(campus.costOfLiving.internet / people), monthlyInsuranceCents: cents(campus.costOfLiving.insurance),
    monthlyParkingCents: cents(query.parking ?? campus.costOfLiving.parking), monthlyCommuteCents: cents(campus.costOfLiving.transportation),
    securityDepositCents: cents(query.monthlyRent / people), applicationFeesCents: 5000, movingCostsCents: 15000,
  };
  const notices = ['Move-in assumptions: one month of rent as deposit, $50 application fee, $150 moving cost. Lease end is exclusive.', 'Rent, utilities and internet split equally; insurance, parking and transportation are personal costs.'];
  if (id === 'michigan' && query.roommates <= 1) {
    const result = await buildCampusHousingScenario({ campusId: 'umich', name: housing.name, leaseStart: start, leaseEnd: housing.leaseEnd,
      monthlyApartmentRentDollars: query.monthlyRent, bedrooms: people, roommates: query.roommates, commute: 'walk',
      monthlyParkingCents: housing.monthlyParkingCents, securityDepositCents: housing.securityDepositCents,
      applicationFeesCents: housing.applicationFeesCents, movingCostsCents: housing.movingCostsCents });
    housing = result.scenario;
    notices.push('Michigan campus dataset · placeholder estimates with seasonal utilities. Walking commute assumed.', ...result.assumptions);
  } else notices.push(`${campus.shortName} campus costs are sample assumptions; verified campus estimates are unavailable for this configuration.`);
  if (query.utilities !== undefined) { housing.monthlyUtilitiesCents = cents(query.utilities / people); delete housing.monthlyUtilitiesByMonthCents; }
  return { housing, notices };
}

export function presentScenario(profile: FinancialProfile, housing: EngineHousing, query: HousingQuery, id = 'custom'): HousingScenario {
  const forecastDays = Math.round((Date.parse(housing.leaseEnd + 'T00:00:00Z') - Date.parse(profile.asOfDate + 'T00:00:00Z')) / 86400000) - 1;
  const { forecast } = selectSpendingForecast(profile, forecastDays);
  const calculated = evaluateAffordability(profile, housing, { spendingForecast: forecast });
  const summary = summarizeFinances(profile);
  const monthlyIncome = summary.months.reduce((sum, m) => sum + m.incomeCents, 0) / summary.months.length / 100;
  const monthlySpending = summary.months.reduce((sum, m) => sum + m.expenseCents, 0) / summary.months.length / 100;
  const months = new Map<string, typeof calculated.dailyBalances>();
  for (const day of calculated.dailyBalances) { const month = day.date.slice(0, 7); months.set(month, [...(months.get(month) ?? []), day]); }
  const label = (month: string) => new Date(month + '-01T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const cashFlow: CashFlowPoint[] = [...months].map(([month, days]) => {
    const lowest = Math.min(...days.map(d => d.projectedBalanceCents)) / 100;
    return { month: label(month), projectedBalance: lowest, distanceFromBuffer: lowest - profile.safetyBufferCents / 100, event: 'Lowest daily balance this month', eventKind: lowest < profile.safetyBufferCents / 100 ? 'warning' : undefined };
  });
  const riskMonths = [...months].filter(([, days]) => days.some(d => d.belowSafetyBuffer)).map(([m]) => label(m));
  const status = calculated.dailyBalances.some(d => d.projectedBalanceCents < 0) ? 'risky' : riskMonths.length ? 'tight' : 'comfortable';
  const breakdown = { rent: housing.monthlyRentCents / 100, utilities: housing.monthlyUtilitiesCents / 100, internet: housing.monthlyInternetCents / 100,
    insurance: housing.monthlyInsuranceCents / 100, parking: housing.monthlyParkingCents / 100, transportation: housing.monthlyCommuteCents / 100, total: calculated.monthlyHousingCostCents / 100 };
  const remaining = monthlyIncome - monthlySpending - breakdown.total;
  return { id, title: query.roommates ? 'Off-campus, shared' : 'Off-campus, alone', monthlyRent: query.monthlyRent, roommates: query.roommates,
    monthlyCost: breakdown.total, monthlyRemaining: remaining, savingsVsSolo: 0, status, cashFlow,
    query, result: { status, summary: housing.name, monthlyRemaining: remaining, trueMonthlyCost: breakdown.total, safetyBuffer: profile.safetyBufferCents / 100,
      riskMonths, breakdown, upfrontCashRequired: calculated.upfrontCashRequiredCents / 100,
      explanation: calculated.assumptions.join(' '), recommendation: calculated.warnings.join(' ') || 'Projected daily balances stay above your safety cushion under these assumptions.' } };
}

export async function analyze(id: CampusId, query: HousingQuery) {
  campusFor(id); validateQuery(query);
  const context = await financialContext();
  const built = await buildHousing(id, query, context.profile);
  const scenario = presentScenario(context.profile, built.housing, query);
  const comparisons = await Promise.all([0, 1].map(async roommates => {
    const q = { ...query, roommates };
    const candidate = await buildHousing(id, q, context.profile);
    return presentScenario(context.profile, candidate.housing, q, roommates ? 'roommate' : 'solo');
  }));
  const campusQuery = { monthlyRent: Math.round(campusFor(id).rentBenchmarks.typical * 1.13), roommates: 0, leaseStart: query.leaseStart };
  const campusBuilt = await buildHousing(id, campusQuery, context.profile);
  const campusOption = presentScenario(context.profile, campusBuilt.housing, campusQuery, 'campus');
  campusOption.title = 'University housing · sample estimate';
  comparisons.push(campusOption);
  comparisons.forEach(s => { s.savingsVsSolo = comparisons[0].monthlyCost - s.monthlyCost; });
  scenario.comparisons = comparisons;
  return { scenario, ...built, ...context };
}

export async function dashboard(id: CampusId): Promise<CampusDashboardData> {
  const campus = campusFor(id);
  const context = await financialContext();
  const make = async (rent: number, roommates: number, key: string) => {
    const query = { monthlyRent: rent, roommates };
    const built = await buildHousing(id, query, context.profile);
    return presentScenario(context.profile, built.housing, query, key);
  };
  const scenarios = await Promise.all([make(campus.rentBenchmarks.typical, 0, 'solo'), make(campus.rentBenchmarks.typical, 1, 'roommate'), make(Math.round(campus.rentBenchmarks.typical * 1.13), 0, 'campus')]);
  scenarios[2].title = 'University housing · sample estimate';
  scenarios.forEach(s => { s.savingsVsSolo = scenarios[0].monthlyCost - s.monthlyCost; });
  const history = summarizeFinances(context.profile);
  const avg = (field: 'incomeCents' | 'expenseCents') => history.months.reduce((n, m) => n + m[field], 0) / history.months.length / 100;
  const neighborhoods = id === 'michigan' ? listNeighborhoods('umich').map((n, i) => ({ id: `umich-${i}`, name: n.neighborhood, typicalRent: n.rent_ranges['1']?.low ?? campus.rentBenchmarks.typical, commute: 'Commute time unavailable', note: n.notes, studentFit: 'Campus rent benchmark' })) : campus.neighborhoods;
  const mapped = await Promise.all(neighborhoods.map(async n => { const s = await make(n.typicalRent, 0, n.id); return { ...n, estimatedMonthlyCost: s.monthlyCost, status: s.status }; }));
  const built = await buildHousing(id, { monthlyRent: campus.rentBenchmarks.typical, roommates: 0 }, context.profile);
  return { campus, source: context.source, assistantMode: webQuestionInterpreter().mode, notices: [...context.notices, ...built.notices, `Historical averages: ${history.historyStartDate} to ${history.historyEndDate}. Future paydays are modeled separately. Chart shows each month's lowest daily balance.`, 'University housing and representative property rents are sample assumptions.'],
    financials: { currentBalance: context.profile.availableBalanceCents / 100, monthlyIncome: avg('incomeCents'), monthlySpending: avg('expenseCents'), safetyBuffer: context.profile.safetyBufferCents / 100 },
    affordability: scenarios[0].result, cashFlow: scenarios[0].cashFlow, scenarios, neighborhoods: mapped,
    rentEstimates: await Promise.all([campus.rentBenchmarks.low, campus.rentBenchmarks.typical, campus.rentBenchmarks.high].map(async rent => ({ monthlyRent: rent, result: (await make(rent, 0, 'estimate')).result }))) };
}

export async function ask(id: CampusId, query: HousingQuery, question: string) {
  if (typeof question !== 'string' || !question.trim() || question.length > 8000) throw new InputError('Enter a question of 1 to 8,000 characters.');
  const { interpret, mode } = webQuestionInterpreter();
  let parsed;
  try { parsed = await interpret(question); }
  catch (error) { throw new InputError(error instanceof Error ? error.message : 'ASI could not understand that question. Please retry.'); }
  if (parsed.intent === 'unknown') return { id: `assistant-${Date.now()}`, role: 'assistant', createdAt: 'Now', content: 'I couldn’t understand that as a financial question. Ask about apartment rent, roommates, move-in savings, spending, or a month in your forecast.', mode };
  const rent = question.match(/(?:\$|rent\s+(?:of\s+)?)([\d,]+)(?:\.\d+)?/i);
  const followup = { ...query, ...(rent ? { monthlyRent: Number(rent[1].replaceAll(',', '')) } : {}), ...(/roommate/i.test(question) ? { roommates: Math.max(1, query.roommates) } : {}) };
  const context = await analyze(id, followup);
  const agent = await runFinanceAgent({ question, profile: context.profile, housing: context.housing }, async () => parsed);
  return { id: `assistant-${Date.now()}`, role: 'assistant', createdAt: 'Now', content: `${campusFor(id).name}: ${agent.message} Risk months: ${context.scenario.result.riskMonths.join(', ') || 'none'}. ${context.notices.join(' ')}`, scenario: context.scenario };
}
