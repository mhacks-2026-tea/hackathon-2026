import assert from "node:assert/strict";
import type { FinancialProfile, HousingScenario } from "../src/lib/finance/types.ts";
import { predictLearnedSpending, evaluateSpendingModel, selectSpendingForecast } from "../src/lib/finance/spending-model.ts";
import { createModelInterpreter, runFinanceAgent } from "../src/lib/finance/agent.ts";

/** Synthetic fixtures measure behavior, not real student accuracy. */
export function fixture(kind: "weekday" | "constant", days = 84): FinancialProfile {
  const dates = Array.from({ length: days }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)));
  return { historyStartDate: "2026-01-01", asOfDate: dates.at(-1)!.toISOString().slice(0, 10),
    availableBalanceCents: 500000, safetyBufferCents: 50000, scheduledCashFlows: [],
    transactions: dates.map((date, index) => ({ id: `purchase-${index}`, date: date.toISOString().slice(0, 10),
      amountCents: kind === "constant" ? 1000 : [0, 500, 700, 800, 900, 3000, 6000][date.getUTCDay()],
      direction: "expense", spendingType: "variable", category: "food", description: "Synthetic purchase" })),
  };
}

const periodic = fixture("weekday");
const evaluation = evaluateSpendingModel(periodic);
assert.equal(evaluation.folds, 4);
assert.equal(evaluation.predictedDays, 56);
assert.equal(evaluation.recommendedMethod, "machine-learning");
assert.ok(evaluation.machineLearning!.maeCents < evaluation.baseline!.maeCents);
assert.equal(evaluateSpendingModel(fixture("constant")).recommendedMethod, "baseline");
assert.equal(predictLearnedSpending(fixture("weekday", 27)).method, "baseline");
assert.equal(evaluateSpendingModel(fixture("weekday", 41)).status, "insufficient-history");
assert.equal(selectSpendingForecast(periodic, 30).forecast.predictions.length, 30);
assert.throws(() => predictLearnedSpending(periodic, 0));
assert.throws(() => predictLearnedSpending({ ...periodic, transactions: [...periodic.transactions, periodic.transactions[0]] }));
const forecasts = predictLearnedSpending(periodic).predictions;
for (const day of forecasts) {
  assert.ok(Number.isSafeInteger(day.predictedCents));
  assert.ok(day.lowerEstimateCents <= day.predictedCents && day.predictedCents <= day.upperEstimateCents);
}
// Out-of-window purchases must not affect learning or evaluation.
const future = { ...periodic, transactions: [...periodic.transactions,
  { ...periodic.transactions[0], id: "future", date: "2027-01-01", amountCents: 999999 }] };
assert.deepEqual(predictLearnedSpending(future), predictLearnedSpending(periodic));
assert.deepEqual(evaluateSpendingModel(future), evaluation);
// Independently reconstruct a single held-out fold to check evaluation arithmetic.
const single = fixture("weekday", 42);
const training = { ...single, asOfDate: "2026-01-28", transactions: single.transactions.slice(0, 28) };
const predicted = predictLearnedSpending(training).predictions;
const expectedMae = predicted.reduce((sum, day, index) => sum + Math.abs(day.predictedCents - single.transactions[index + 28].amountCents), 0) / 14;
assert.equal(evaluateSpendingModel(single).machineLearning!.maeCents, expectedMae);

const incomplete = await runFinanceAgent({ question: "Can I afford this apartment?", profile: periodic });
assert.equal(incomplete.status, "needs-details");
assert.ok(incomplete.missingFields.includes("housing.securityDepositCents"));
assert.deepEqual(incomplete.toolCalls, []);
assert.equal((await runFinanceAgent({ question: "hello" })).intent, "unknown");
const forecast = await runFinanceAgent({ question: "Predict spending for 30 days", profile: periodic });
assert.equal(forecast.status, "answered");
assert.ok(forecast.message.includes("30 days"));
assert.ok(forecast.toolCalls.includes("predictLearnedSpending"));
const housing: HousingScenario = { name: "Fictional listing", leaseStart: "2026-03-26", leaseEnd: "2026-04-26",
  monthlyRentCents: 100000, monthlyUtilitiesCents: 5000, monthlyInternetCents: 3000,
  monthlyInsuranceCents: 1000, monthlyParkingCents: 0, monthlyCommuteCents: 0,
  securityDepositCents: 100000, applicationFeesCents: 0, movingCostsCents: 0 };
const completed = await runFinanceAgent({ question: "Here are the details", previousIntent: "affordability", profile: periodic, housing });
assert.equal(completed.status, "answered");
assert.ok(completed.toolCalls.includes("evaluateAffordability"));
assert.ok(completed.message.includes("first month's rent"));
assert.ok(completed.assumptions.length > 0);
await assert.rejects(runFinanceAgent({ question: "rent", profile: periodic, housing: { ...housing, monthlyRentCents: -1 } }));
await assert.rejects(runFinanceAgent({ question: "predict 500 days", profile: periodic }));
await assert.rejects(runFinanceAgent({ question: " " }));

let prompt = "";
const model = createModelInterpreter(async input => { prompt = input; return '{"intent":"spending","forecastDays":7}'; });
const modeled = await runFinanceAgent({ question: "How much will my daily purchases total next week?", profile: periodic }, model);
assert.equal(modeled.status, "answered");
assert.ok(modeled.message.includes("7 days"));
assert.ok(!prompt.includes("purchase-0")); // Financial history is not sent to the model.
await assert.rejects(createModelInterpreter(async () => "not json")("test"));
await assert.rejects(createModelInterpreter(async () => '{"intent":"transfer-money"}')("test"));
await assert.rejects(createModelInterpreter(async () => '{"intent":"spending","forecastDays":-1}')("test"));
await assert.rejects(runFinanceAgent({ question: "test" }, async () => ({ intent: "spending", forecastDays: 999 })));
console.log("PASS: spending model, chronological evaluation, clarification, engine calls, and AI interpreter validation.");
console.log(JSON.stringify({ syntheticWeekdayEvaluation: evaluation, syntheticConstantEvaluation: evaluateSpendingModel(fixture("constant")) }, null, 2));
