import type { FinancialProfile } from '../../src/lib/finance/types';

/** Explicit fictional Alex demo inputs. Outputs always come from the finance engine. */
export function alexDemoProfile(): FinancialProfile {
  return {
    asOfDate: '2026-04-30', historyStartDate: '2026-02-01',
    availableBalanceCents: 384200, safetyBufferCents: 50000,
    transactions: [2, 3, 4].flatMap(month => [
      { id: `income-${month}`, date: `2026-0${month}-15`, amountCents: 195000, direction: 'income' as const, category: 'income', description: 'Fictional Alex income', spendingType: 'scheduled' as const },
      ...[5, 12, 19, 26].map(day => ({ id: `spend-${month}-${day}`, date: `2026-0${month}-${String(day).padStart(2, '0')}`, amountCents: 15000, direction: 'expense' as const, category: 'everyday', description: 'Fictional Alex spending', spendingType: 'variable' as const })),
    ]),
    scheduledCashFlows: [5, 6, 9, 10, 11, 12].map(month => ({
      id: `pay-${month}`, label: 'Fictional school-year income', date: `2026-${String(month).padStart(2, '0')}-15`,
      amountCents: 195000, direction: 'income' as const, certainty: 'confirmed' as const,
    })),
  };
}
