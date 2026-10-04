/** Server-side campus estimates. Source values remain in data/ JSON and CSV files. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
type Data = Record<string, unknown>;
export type CostRange = { low: number; expected: number; high: number };
export type UtilityRange = Omit<CostRange, 'high'> & { high: number | null };
export type RentRange = { low: number; high: number | null; high_lower_bound: number | null };
export interface CampusProfile {
  id: string; name: string; city: string; state: string;
  term_start_dates: Data; student_fare_notes: string;
}
export interface Neighborhood {
  neighborhood: string; notes: string; source: string; rent_ranges: Record<string, RentRange>;
}
export interface CampusMonth {
  items: Record<'rent' | 'utilities' | 'internet' | 'renters_insurance' | 'groceries' | 'commute', CostRange>;
  total: CostRange; confidence: 'generic'; data_status: 'placeholder' | 'verified'; assumptions: unknown;
}
export interface MonthlyCostInput {
  campusId: string; rent: number; roommates?: number; commute?: string; month?: string; bedrooms?: number;
}
function object(value: unknown, field: string): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Missing or invalid ${field}`);
  return value as Data;
}
function nonnegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${field} must be a finite nonnegative number`);
  return value;
}
function integer(value: unknown, field: string): number {
  const n = nonnegative(value, field);
  if (!Number.isSafeInteger(n)) throw new Error(`${field} must be a nonnegative integer`);
  return n;
}
export function costRange(value: unknown, field: string): CostRange {
  const raw = object(value, field);
  const low = nonnegative(raw.low, `${field}.low`);
  const expected = nonnegative(raw.expected, `${field}.expected`);
  const high = nonnegative(raw.high, `${field}.high`);
  if (!(low <= expected && expected <= high)) throw new Error(`${field}: require low <= expected <= high`);
  return { low, expected, high };
}
function campusId(id: string): void {
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid campus ID');
}
function load(id: string): Data {
  campusId(id);
  return object(JSON.parse(readFileSync(join(DATA_DIR, 'campuses', `${id}.json`), 'utf8')), 'campus profile');
}
export function getCampusProfile(id: string): CampusProfile {
  const data = load(id);
  for (const key of ['id', 'name', 'city', 'state', 'student_fare_notes']) {
    if (typeof data[key] !== 'string' || !(data[key] as string).trim()) throw new Error(`Missing or invalid ${key}`);
  }
  if (data.id !== id) throw new Error('id must match requested campus');
  return {
    id, name: data.name as string, city: data.city as string, state: data.state as string,
    student_fare_notes: data.student_fare_notes as string,
    term_start_dates: object(data.term_start_dates, 'term_start_dates'),
  };
}

/** CSV parsing supports quoted commas/newlines, escaped quotes, CRLF and a BOM. */
function csvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closed = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else cell += ch;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (ch !== ',') {
        if (row.some(value => value !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      }
    } else if (ch === '"' && cell === '' && !closed) quoted = true;
    else {
      if (closed || ch === '"') throw new Error('Malformed CSV quoting');
      cell += ch;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quote');
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  return rows;
}
function endpoint(value: string, field: string): number {
  const numeric = value.replace(/\+$/, '');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric)) throw new Error(`${field}: invalid rent endpoint`);
  return nonnegative(Number(numeric), field);
}
export function parseNeighborhoods(csv: string): Neighborhood[] {
  const [headers = [], ...rows] = csvRows(csv);
  for (const name of ['neighborhood', 'source', 'rent_1_bedroom_low', 'rent_1_bedroom_high']) {
    if (!headers.includes(name)) throw new Error(`Missing column ${name}`);
  }
  if (new Set(headers).size !== headers.length) throw new Error('Duplicate CSV columns');
  const result: Neighborhood[] = [];
  for (const cells of rows) {
    if (cells.length > headers.length) throw new Error('CSV row has extra cells');
    const row = Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
    const name = row.neighborhood.trim();
    if (!name) continue;
    const ranges: Record<string, RentRange> = {};
    for (const group of ['1', '2', '3_plus']) for (const shared of [false, true]) {
      const prefix = shared ? `shared_${group}_bedroom_per_person` : `rent_${group}_bedroom`;
      const lowText = (row[`${prefix}_low`] ?? '').trim(), highText = (row[`${prefix}_high`] ?? '').trim();
      if (!lowText && !highText) continue;
      if (!lowText || !highText || lowText.endsWith('+')) throw new Error(`${prefix}: require complete ordered endpoints`);
      const low = endpoint(lowText, prefix), high = endpoint(highText, prefix);
      if (low > high) throw new Error(`${prefix}: require complete ordered endpoints`);
      ranges[(shared ? 'shared_' : '') + group] = { low, high: highText.endsWith('+') ? null : high, high_lower_bound: highText.endsWith('+') ? high : null };
    }
    if (Object.keys(ranges).length) result.push({ neighborhood: name, notes: row.notes ?? '', source: row.source, rent_ranges: ranges });
  }
  return result;
}
export function listNeighborhoods(id: string): Neighborhood[] {
  campusId(id);
  return parseNeighborhoods(readFileSync(join(DATA_DIR, 'neighborhoods', `${id}_neighborhoods.csv`), 'utf8'));
}
function rangeKey(bedrooms: number, shared: boolean): string {
  if (integer(bedrooms, 'bedrooms') < 1) throw new Error('bedrooms must be a positive integer');
  if (typeof shared !== 'boolean') throw new Error('shared must be a boolean');
  return (shared ? 'shared_' : '') + (bedrooms <= 2 ? String(bedrooms) : '3_plus');
}
export function getRentBenchmark(id: string, bedrooms: number, shared = false) {
  const key = rangeKey(bedrooms, shared);
  const ranges = listNeighborhoods(id).flatMap(row => row.rent_ranges[key] ? [row.rent_ranges[key]] : []);
  if (!ranges.length) throw new Error('No supplied rent ranges for this bedroom group');
  return { low: Math.min(...ranges.map(r => r.low)), high: ranges.some(r => r.high === null) ? null : Math.max(...ranges.map(r => r.high!)) };
}
export function findNeighborhoodsInBudget(id: string, maxRent: number, bedrooms: number, shared = false) {
  nonnegative(maxRent, 'maxRent');
  const key = rangeKey(bedrooms, shared);
  return listNeighborhoods(id).filter(row => row.rent_ranges[key] && row.rent_ranges[key].low <= maxRent);
}
function utilities(data: Data, month: string, bedrooms: number, roommates: number): UtilityRange {
  if (typeof month !== 'string' || !MONTHS.includes(month.toLowerCase())) throw new Error('month must be a full month name');
  integer(bedrooms, 'bedrooms'); integer(roommates, 'roommates');
  const monthly = object(object(data.utility_ranges_by_month, 'utility_ranges_by_month')[month.toLowerCase()], `utility_ranges_by_month.${month}`);
  let group = String(Math.max(bedrooms, 1));
  if (!(group in monthly) && bedrooms > 2) group = '3_plus';
  const field = `utility_ranges_by_month.${month}.${group}`;
  const raw = object(monthly[group], field);
  let household: UtilityRange;
  if (raw.high === null) {
    const low = nonnegative(raw.low, `${field}.low`), expected = nonnegative(raw.expected, `${field}.expected`);
    const lower = nonnegative(raw.high_lower_bound, `${field}.high_lower_bound`);
    if (!(low <= expected && expected <= lower)) throw new Error(`${field}: invalid open range`);
    household = { low, expected, high: null };
  } else household = costRange(raw, field);
  if (roommates && data.utility_split !== 'equal') throw new Error('Utility shares are user-defined; equal split is not approved');
  if (roommates && data.utility_sharing_occupants != null && roommates + 1 !== data.utility_sharing_occupants) throw new Error('Utility sharing is approved only for the configured number of occupants');
  return { low: household.low / (roommates + 1), expected: household.expected / (roommates + 1), high: household.high === null ? null : household.high / (roommates + 1) };
}
export function estimateUtilities(id: string, month: string, bedrooms: number, roommates: number): UtilityRange {
  return utilities(load(id), month, bedrooms, roommates);
}
function commuteCost(data: Data, method: string): CostRange {
  if (typeof method !== 'string' || !['walk', 'bike', 'bus'].includes(method.toLowerCase())) throw new Error('method must be walk, bike, or bus');
  return costRange(object(data.commute_cost_ranges, 'commute_cost_ranges')[method.toLowerCase()], `commute_cost_ranges.${method}`);
}
export function estimateCommuteCost(id: string, method: string): CostRange { return commuteCost(load(id), method); }

export function estimateTrueMonthlyCost(input: MonthlyCostInput): CampusMonth {
  const data = load(input.campusId), rent = nonnegative(input.rent, 'rent');
  const roommates = integer(input.roommates ?? 0, 'roommates');
  const config = object(data.monthly_cost_config, 'monthly_cost_config');
  const bedrooms = integer(input.bedrooms ?? config.bedrooms, 'bedrooms');
  if (roommates && config.sharing_occupants != null && roommates + 1 !== config.sharing_occupants) throw new Error('Sharing is approved only for the configured number of occupants');
  const basis = object(config.basis, 'monthly_cost_config.basis');
  for (const name of ['rent', 'internet', 'renters_insurance', 'groceries']) {
    if (!['household', 'per_person'].includes(String(basis[name]))) throw new Error(`Missing or invalid monthly_cost_config.basis.${name}`);
  }
  if (basis.rent !== 'household') throw new Error('Rent input must use household basis');
  const ranges = object(data.monthly_cost_ranges, 'monthly_cost_ranges');
  const status = data.data_status ?? 'placeholder';
  if (status !== 'placeholder' && status !== 'verified') throw new Error('Invalid data_status');
  const month = input.month ?? MONTHS[new Date().getMonth()];
  const utility = utilities(data, month, bedrooms, roommates);
  if (utility.high === null) throw new Error('Cannot produce a finite monthly high total: a component has an open-ended upper range');
  const sharedRange = (name: string): CostRange => {
    const r = costRange(ranges[name], `monthly_cost_ranges.${name}`), divisor = basis[name] === 'household' ? roommates + 1 : 1;
    return { low: r.low / divisor, expected: r.expected / divisor, high: r.high / divisor };
  };
  const items: CampusMonth['items'] = {
    rent: { low: rent / (roommates + 1), expected: rent / (roommates + 1), high: rent / (roommates + 1) },
    utilities: { ...utility, high: utility.high },
    internet: sharedRange('internet'), renters_insurance: sharedRange('renters_insurance'), groceries: sharedRange('groceries'),
    commute: commuteCost(data, input.commute ?? 'bus'),
  };
  const sum = (key: keyof CostRange) => nonnegative(Object.values(items).reduce((s, r) => s + r[key], 0), 'Monthly total');
  return { items, total: { low: sum('low'), expected: sum('expected'), high: sum('high') }, confidence: 'generic', data_status: status, assumptions: data.monthly_cost_assumptions ?? '' };
}
