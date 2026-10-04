import { getStudentFinancialData } from "../lib/nessie.js";
import { adaptNessieData } from "../src/lib/finance/nessie-adapter.ts";

/**
 * Live read-only bridge check:
 * node --env-file=.env.local --import tsx scripts/check-finance-nessie.ts
 * Also set FINANCE_HISTORY_START=YYYY-MM-DD to the known history coverage start.
 * No balances, transactions, API keys, or customer IDs are printed.
 */
const customerId = process.env.NESSIE_CUSTOMER_ID?.trim();
const historyStartDate = process.env.FINANCE_HISTORY_START?.trim();
if (!customerId || !historyStartDate) {
  throw new Error("Set NESSIE_CUSTOMER_ID and FINANCE_HISTORY_START in your private .env.local.");
}

// Use UTC for the snapshot date, consistent with the engine's calendar logic.
const asOfDate = new Date().toISOString().slice(0, 10);
const bankingData = await getStudentFinancialData(customerId, process.env.NESSIE_ACCOUNT_ID?.trim() || undefined);
const { profile, warnings } = adaptNessieData(bankingData, {
  asOfDate,
  historyStartDate,
  safetyBufferCents: 50000, // Demo buffer only; the app will accept a user setting.
});

// Check that his completed module's actual return type satisfies our adapter.
console.log("Live Nessie fetch and finance conversion succeeded.");
console.log(`Converted ${profile.transactions.length} historical transactions and ${profile.scheduledCashFlows.length} scheduled payments.`);
console.log(`Adapter produced ${warnings.length} warnings; review data coverage before forecasting.`);
