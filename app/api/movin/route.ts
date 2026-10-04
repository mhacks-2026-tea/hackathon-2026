import { respondToChat } from '@/lib/server/conversation';
import { CHAT_COOKIE, openChat, sealChat } from '@/lib/server/chat-state';
import { ASIError } from '@/lib/server/asi-extraction';
import { NextResponse } from 'next/server';
import { analyze, ask, campusFor, dashboard, InputError, validateQuery } from '@/lib/server/movin';
import type { CampusId } from '@/lib/frontend/campus-types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof InputError || error instanceof ASIError ? error.message : 'Unable to calculate financial data. Check server configuration, history coverage, and lease dates.' }, { status: error instanceof InputError ? 422 : 503 });
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
    const text = await request.text();
    if (Buffer.byteLength(text) > 20000) throw new InputError('Request is too large.');
    try { body = JSON.parse(text); } catch { throw new InputError('Send valid apartment details.'); }
    if (!body || typeof body !== 'object') throw new InputError('Send apartment details.');
    const id = campusFor(body.campus).id;
    const query = validateQuery(body.query);
    if (body.action === 'ask' && process.env.ASI1_API_KEY?.trim()) {
      const token = request.headers.get('cookie')?.split(';').map(c => c.trim()).find(c => c.startsWith(CHAT_COOKIE + '='))?.slice(CHAT_COOKIE.length + 1);
      const result = await respondToChat(id, query, body.question, openChat(token));
      const response = NextResponse.json(result.reply, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(CHAT_COOKIE, sealChat(result.state), { httpOnly: true, secure: new URL(request.url).protocol === 'https:', sameSite: 'lax', path: '/api/movin', maxAge: 600 });
      return response;
    }
    const result = body.action === 'ask' ? await ask(id, query, body.question) : (await analyze(id, query)).scenario;
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
