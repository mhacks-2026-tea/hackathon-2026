import type { AffordabilityResult, ChatMessage, DashboardData, HousingQuery, HousingScenario } from '../types';
import type { CampusDashboardData, CampusId } from '../frontend/campus-types';
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined, cache: 'no-store', signal: AbortSignal.timeout(90000) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Movin could not load this estimate. Try again.');
  return value as T;
}
export function getDashboardData(campusId: CampusId): Promise<CampusDashboardData> {
  return request(`/api/movin?campus=${encodeURIComponent(campusId)}`);
}
export function estimateHousingScenario(query: HousingQuery, data: Pick<DashboardData, 'campus'>): Promise<HousingScenario> {
  return request('/api/movin', { campus: data.campus.id, query });
}
export async function simulateHousingDecision(query: HousingQuery, data: DashboardData): Promise<AffordabilityResult> {
  return (await estimateHousingScenario(query, data)).result;
}
export function sendAssistantMessage(question: string, data: DashboardData, query: HousingQuery, history: ChatMessage[] = []): Promise<ChatMessage & { scenario?: HousingScenario }> {
  return request('/api/movin', { action: 'ask', campus: data.campus.id, query, question, history: history.slice(-8).map(({ role, content }) => ({ role, content: content.slice(0, 1500) })) });
}
