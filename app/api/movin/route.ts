import { NextResponse } from 'next/server';
import { analyze, ask, campusFor, dashboard, InputError, validateQuery } from '@/lib/server/movin';
import type { CampusId } from '@/lib/frontend/campus-types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof InputError ? error.message : 'Unable to calculate financial data. Check server configuration, history coverage, and lease dates.' }, { status: error instanceof InputError ? 422 : 503 });
}
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('campus') ?? 'michigan';
    campusFor(id);
    return NextResponse.json(await dashboard(id as CampusId), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get('content-length')) > 20000) throw new InputError('Request is too large.');
    let body;
    try { body = JSON.parse(await request.text()); } catch { throw new InputError('Send valid apartment details.'); }
    if (!body || typeof body !== 'object') throw new InputError('Send apartment details.');
    const id = campusFor(body.campus).id;
    const query = validateQuery(body.query);
    const result = body.action === 'ask' ? await ask(id, query, body.question) : (await analyze(id, query)).scenario;
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
