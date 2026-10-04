import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import * as campus from '../campus/loader.ts';

const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/campus-parity.json', import.meta.url), 'utf8')) as {
  cases: { fn: string; args: unknown[]; expected: unknown }[];
};
const functions = campus as unknown as Record<string, (...args: unknown[]) => unknown>;
for (const example of fixture.cases) {
  assert.deepEqual(functions[example.fn](...example.args), example.expected, `${example.fn} ${JSON.stringify(example.args)}`);
}
console.log(`PASS ${fixture.cases.length} frozen Python parity cases`);

const header = 'neighborhood,source,rent_1_bedroom_low,rent_1_bedroom_high';
for (const row of ['Test,Source,200,100', 'Test,Source,bad,200', 'Test,Source,-1,200', 'Test,Source,100+,200', 'Test,Source,,200', 'Test,Source,100,200,extra']) {
  assert.throws(() => campus.parseNeighborhoods(`${header}\n${row}\n`));
}
assert.throws(() => campus.parseNeighborhoods('neighborhood\nTest\n'), /source/);
assert.throws(() => campus.parseNeighborhoods(`${header},source\n`), /Duplicate/);
assert.throws(() => campus.parseNeighborhoods(`${header}\n"unterminated`), /Unterminated/);
const quoted = campus.parseNeighborhoods(`\uFEFF${header},notes\r\n"Area, north",Source,100,200,"Line one\nLine ""two"""\r\n`);
assert.equal(quoted[0].neighborhood, 'Area, north');
assert.equal(quoted[0].notes, 'Line one\nLine "two"');
for (const id of ['../umich', '..', '/umich', 'umich\\other', '']) assert.throws(() => campus.getCampusProfile(id));
assert.throws(() => campus.getRentBenchmark('umich', 0));
assert.throws(() => campus.getRentBenchmark('umich', 1, 1 as unknown as boolean));
for (const n of [-1, NaN, Infinity, true]) {
  assert.throws(() => campus.estimateTrueMonthlyCost({ campusId: 'umich', rent: n as number, bedrooms: 1 }));
}
assert.throws(() => campus.estimateUtilities('umich', 'january', 1, 2), /configured number/);
assert.throws(() => campus.estimateUtilities('umich', 'invalid', 1, 0));
assert.throws(() => campus.estimateTrueMonthlyCost({ campusId: 'umich', rent: 100 }), /bedrooms/);
assert.throws(() => campus.estimateCommuteCost('umich', 'car'));
assert.throws(() => campus.costRange({ low: 30, expected: 20, high: 10 }, 'test'));
assert.equal('estimateMoveInCost' in campus, false);

// Isolated temporary data checks missing fields and open utility bounds.
const id = `test-${process.pid}-${Date.now()}`;
const path = join(campus.DATA_DIR, 'campuses', `${id}.json`);
const real = JSON.parse(readFileSync(join(campus.DATA_DIR, 'campuses/umich.json'), 'utf8'));
const save = (data: unknown) => writeFileSync(path, JSON.stringify(data));
try {
  for (const field of ['id', 'name', 'city', 'state', 'term_start_dates', 'student_fare_notes']) {
    const data = { ...real, id }; delete data[field]; save(data);
    assert.throws(() => campus.getCampusProfile(id), new RegExp(field));
  }
  const data = structuredClone(real); data.id = id;
  data.utility_ranges_by_month.january['1'] = { low: 60, expected: 90, high: null, high_lower_bound: 120 };
  save(data);
  assert.deepEqual(campus.estimateUtilities(id, 'january', 1, 1), { low: 30, expected: 45, high: null });
  assert.throws(() => campus.estimateTrueMonthlyCost({ campusId: id, rent: 100, bedrooms: 1, month: 'january' }), /open-ended/);
  data.utility_ranges_by_month.january['1'].high = 120;
  delete data.monthly_cost_ranges.internet.low; save(data);
  assert.throws(() => campus.estimateTrueMonthlyCost({ campusId: id, rent: 100, bedrooms: 1, month: 'january' }), /monthly_cost_ranges.internet.low/);
  writeFileSync(path, '{'); assert.throws(() => campus.getCampusProfile(id));
} finally { unlinkSync(path); }

// Keep the original source-provenance acceptance checks: every number has a named source/date.
const sourceRows = readFileSync(join(campus.DATA_DIR, 'sources.md'), 'utf8').split('\n')
  .filter(line => line.startsWith('| umich.')).map(line => line.split('|').slice(1, -1).map(v => v.trim()));
function sourced(field: string, value: unknown) {
  const matching = sourceRows.filter(row => row[0] === field && row[1] === String(value));
  assert.ok(matching.some(row => row[3] && row[3] !== 'Not provided'), `Missing source: ${field}`);
  if (!matching.some(row => row[2].toLowerCase().includes('placeholder'))) {
    assert.ok(matching.some(row => /^\d{4}-\d{2}-\d{2}$/.test(row[5])), `Missing source date: ${field}`);
  }
}
function walk(value: unknown, key: string) {
  if (typeof value === 'number') sourced(key, value);
  else if (value && typeof value === 'object') for (const [child, item] of Object.entries(value)) walk(item, `${key}.${child}`);
}
walk(real, 'umich');
for (const row of campus.listNeighborhoods('umich')) for (const [key, range] of Object.entries(row.rent_ranges)) {
  const shared = key.startsWith('shared_'); const group = key.replace(/^shared_/, '');
  const prefix = shared ? `shared_${group}_bedroom_per_person` : `rent_${group}_bedroom`;
  sourced(`umich.${row.neighborhood}.${prefix}_low`, range.low);
  sourced(`umich.${row.neighborhood}.${prefix}_high`, range.high ?? `${range.high_lower_bound}+`);
}
console.log('PASS campus validation, CSV quoting, missing fields, open utility bounds, and source provenance');

// Regression checks migrated from tests/test_integration_gaps.py.
assert.deepEqual(campus.getRentBenchmark('umich', 1), { low: 825, high: 2550 });
assert.deepEqual(campus.getRentBenchmark('umich', 2, true), { low: 700, high: 1750 });
const kerrytown = campus.listNeighborhoods('umich').find(row => row.neighborhood === 'Kerrytown')!;
assert.deepEqual(kerrytown.rent_ranges.shared_3_plus, { low: 833, high: null, high_lower_bound: 1500 });
assert.equal(campus.getRentBenchmark('umich', 4).high, null);
const matches = campus.findNeighborhoodsInBudget('umich', 1000, 1);
assert.deepEqual(matches.map(row => row.neighborhood), ['Oxbridge']);
assert.equal(matches[0].rent_ranges['1'].high, 1200);
assert.equal('bus_minutes' in matches[0], false);
assert.deepEqual(campus.findNeighborhoodsInBudget('umich', 700, 2, true).map(row => row.neighborhood), ['Oxbridge']);
assert.deepEqual(campus.findNeighborhoodsInBudget('umich', 699, 2, true), []);
for (const key of ['county', 'typical_lease_start_window', 'security_deposit_months', 'application_fee',
  'parking', 'car_transportation_average', 'monthly_utilities_by_month', 'summer_income_gap_months']) {
  assert.equal(key in real, false, `Unsupported profile field: ${key}`);
}
console.log('PASS migrated integration-gap checks');


