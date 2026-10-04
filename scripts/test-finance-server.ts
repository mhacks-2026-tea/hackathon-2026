import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createFinanceServer } from "../src/lib/finance/http-server.ts";

/** Exercise real HTTP requests with a synthetic banking fetcher; no live keys needed. */
const token = "synthetic-test-token-never-use-in-production";
let calls = 0;
let fail = false;
const server = createFinanceServer({ token, customerId: "fixture", historyStartDate: "2026-10-01", asOfDate: "2026-10-03" }, async id => {
  calls += 1;
  assert.equal(id, "fixture");
  if (fail) throw new Error("private error detail must not leak");
  return { accountType: "Checking", balance: 1800, purchases: [
    { id: "p", merchant: "Test", amount: 54, date: "2026-10-02", status: "completed" },
  ], deposits: [], bills: [] };
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/demo/affordability`;
const payload = { safetyBufferCents: 50000, housing: {
  campusId: "umich", name: "Synthetic apartment", leaseStart: "2026-10-04", leaseEnd: "2026-11-04",
  monthlyApartmentRentDollars: 1050, bedrooms: 1, roommates: 0, commute: "walk",
  monthlyParkingCents: 0, securityDepositCents: 105000, applicationFeesCents: 5000, movingCostsCents: 15000,
} };
const post = (body: unknown, authorized = true) => fetch(url, {
  method: "POST", headers: { "Content-Type": "application/json", ...(authorized ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
try {
  assert.equal((await post(payload, false)).status, 401);
  assert.equal(calls, 0);
  assert.equal((await post({ ...payload, customerId: "another-person" })).status, 422);
  assert.equal(calls, 0);
  const missing = await post({ safetyBufferCents: 50000 });
  assert.equal(missing.status, 422);
  assert.deepEqual((await missing.json()).missingFields, ["housing"]);
  const invalid = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{" });
  assert.equal(invalid.status, 422);
  const good = await post(payload);
  assert.equal(good.status, 200);
  const result = await good.json();
  assert.equal(result.mode, "sandbox-demo");
  assert.equal(result.predictionMethod, "baseline");
  assert.equal(result.affordability.monthlyHousingCostCents, 123000);
  assert.equal(result.affordability.dailyBalances.length, 31);
  // $1,800 snapshot - $1,250 one-time costs - $1,230 housing - $18 spending.
  assert.equal(result.affordability.dailyBalances[0].projectedBalanceCents, -69800);
  assert.equal("transactions" in result, false);
  assert.ok(result.dataWarnings.length > 0);
  fail = true;
  const outage = await post(payload);
  assert.equal(outage.status, 502);
  assert.ok(!(await outage.text()).includes("private error"));
  console.log("PASS HTTP authentication, account isolation, missing inputs, invalid JSON, end-to-end calculation, and upstream errors.");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
