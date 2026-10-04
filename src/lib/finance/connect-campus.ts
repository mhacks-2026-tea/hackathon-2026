import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { HousingScenario } from './types.ts';
import { buildHousingSchedule } from './housing-schedule.ts';
import { evaluateNessieAffordability } from './connect-nessie.ts';
import type { NessieAffordabilityRequest, NessieDataFetcher } from './connect-nessie.ts';

type CostRange = { low: number; expected: number; high: number };
type CampusMonth = {
  items: Record<'rent' | 'utilities' | 'internet' | 'renters_insurance' | 'groceries' | 'commute', CostRange>;
  total: CostRange;
  confidence: string;
  data_status: string;
  assumptions: unknown;
};

export interface CampusHousingRequest {
  campusId: string;
  name: string;
  leaseStart: string;
  leaseEnd: string;
  /** Whole apartment rent in dollars. The campus helper applies approved sharing. */
  monthlyApartmentRentDollars: number;
  bedrooms: number;
  roommates: number;
  commute: 'walk' | 'bike' | 'bus';
  /** Required true for the campus's eligible-student bus fare. */
  eligibleForStudentBusFare?: boolean;
  /** All values below are the student's actual share in integer cents. Explicit zero is allowed. */
  monthlyParkingCents: number;
  securityDepositCents: number;
  applicationFeesCents: number;
  movingCostsCents: number;
}

function cents(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('Campus data must contain finite non-negative dollar estimates.');
  }
  const amount = Math.round(value * 100);
  if (!Number.isSafeInteger(amount)) throw new Error('Campus estimate exceeds the supported range.');
  return amount;
}

/** Local Python is the single source of campus calculations; no duplicated pricing rules. */
async function loadCampusMonths(input: CampusHousingRequest): Promise<Record<string, CampusMonth>> {
  const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = execFile(process.env.CAMPUS_PYTHON || 'python3', ['-m', 'campus.finance_bridge'], {
      cwd: repositoryRoot, timeout: 15_000, maxBuffer: 1024 * 1024,
    }, (error, output, stderr) => {
      if (error) {
        reject(new Error(`Campus estimates unavailable. Check Python and campus inputs. ${stderr.trim()}`));
      } else resolve(output);
    });
    child.stdin?.on('error', () => { /* execFile reports startup/exit failures above. */ });
    child.stdin?.end(JSON.stringify(input));
  });
  const result = JSON.parse(stdout) as { months: Record<string, CampusMonth> };
  for (let month = 1; month <= 12; month++) {
    const item = result.months?.[String(month).padStart(2, '0')];
    if (!item?.items || !item.confidence || !item.data_status) throw new Error('Invalid campus bridge response.');
    for (const name of ['rent', 'utilities', 'internet', 'renters_insurance', 'groceries', 'commute'] as const) {
      const range = item.items[name];
      for (const value of [range?.low, range?.expected, range?.high]) cents(value);
      if (range.low > range.expected || range.expected > range.high) throw new Error('Invalid campus cost range.');
    }
  }
  return result.months;
}

/** Build a scenario while preserving all campus ranges/assumptions for the caller. */
export async function buildCampusHousingScenario(input: CampusHousingRequest) {
  if (typeof window !== 'undefined') throw new Error('Campus integration must run on the server.');
  if (!['walk', 'bike', 'bus'].includes(input.commute)) throw new Error('Campus travel supports walk, bike, or bus.');
  if (input.commute === 'bus' && input.eligibleForStudentBusFare !== true) {
    throw new Error('Confirm eligible student bus fare or choose another supported travel method.');
  }
  // Validate dates and all required user-supplied costs before launching Python.
  const placeholder: HousingScenario = {
    name: input.name, leaseStart: input.leaseStart, leaseEnd: input.leaseEnd,
    monthlyRentCents: 0, monthlyUtilitiesCents: 0, monthlyInternetCents: 0,
    monthlyInsuranceCents: 0, monthlyCommuteCents: 0,
    monthlyParkingCents: input.monthlyParkingCents,
    securityDepositCents: input.securityDepositCents,
    applicationFeesCents: input.applicationFeesCents,
    movingCostsCents: input.movingCostsCents,
  };
  buildHousingSchedule(placeholder);
  const months = await loadCampusMonths(input);
  const first = months[input.leaseStart.slice(5, 7)];
  const scenario: HousingScenario = {
    ...placeholder,
    monthlyRentCents: cents(first.items.rent.expected),
    monthlyUtilitiesCents: cents(first.items.utilities.expected),
    monthlyInternetCents: cents(first.items.internet.expected),
    monthlyInsuranceCents: cents(first.items.renters_insurance.expected),
    monthlyCommuteCents: cents(first.items.commute.expected),
    monthlyUtilitiesByMonthCents: Object.fromEntries(Object.entries(months).map(([month, value]) =>
      [month, cents(value.items.utilities.expected)])),
  };
  buildHousingSchedule(scenario);
  return {
    scenario,
    campusEstimates: months,
    assumptions: [
      'Campus expected estimates are used; low/high ranges, source assumptions, and placeholder status accompany the result.',
      'Utility estimates vary by the calendar month of each lease-anniversary payment.',
      'Campus groceries are excluded from housing costs; everyday spending comes from the finance forecast. Check history coverage before relying on it.',
      'Parking and move-in costs are explicit student-share inputs, not campus defaults.',
      'The monthly housing summary represents the lease-start month; later payments can vary seasonally.',
    ],
  };
}

export async function evaluateCampusNessieAffordability(
  fetchFinancialData: NessieDataFetcher,
  request: Omit<NessieAffordabilityRequest, 'housing'> & { housing: CampusHousingRequest },
) {
  const campus = await buildCampusHousingScenario(request.housing);
  const result = await evaluateNessieAffordability(fetchFinancialData, { ...request, housing: campus.scenario });
  result.affordability.assumptions.push(...campus.assumptions);
  return { ...result, housing: campus.scenario, campusEstimates: campus.campusEstimates };
}
