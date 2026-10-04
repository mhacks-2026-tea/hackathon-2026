import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { NessieDataFetcher } from "./connect-nessie.ts";
import type { CampusHousingRequest } from "./connect-campus.ts";
import { buildCampusHousingScenario } from "./connect-campus.ts";
import { adaptNessieData } from "./nessie-adapter.ts";
import { evaluateAffordability } from "./affordability.ts";
import { selectSpendingForecast } from "./spending-model.ts";

/** This endpoint is for the shared fictional sandbox account, not personal banking. */
export interface DemoServerConfig {
  token: string;
  customerId: string;
  accountId?: string;
  historyStartDate: string;
  asOfDate: string;
}

/** An explicit request error is safe to return; unexpected failures stay private. */
class InputError extends Error {
  constructor(message: string, readonly missingFields: string[] = []) { super(message); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new InputError("Expected a JSON object.");
  }
  return value as Record<string, unknown>;
}

/** Only these inputs are accepted: callers cannot select someone else's account. */
function parseRequest(value: unknown) {
  const body = object(value);
  if (Object.keys(body).some(key => !["housing", "safetyBufferCents", "excludedBillIds"].includes(key))) {
    throw new InputError("Supported fields: housing, safetyBufferCents, excludedBillIds.");
  }
  if (!body.housing) throw new InputError("Provide apartment details.", ["housing"]);
  const housing = object(body.housing);
  const strings = ["campusId", "name", "leaseStart", "leaseEnd", "commute"];
  const numbers = ["monthlyApartmentRentDollars", "bedrooms", "roommates", "monthlyParkingCents",
    "securityDepositCents", "applicationFeesCents", "movingCostsCents"];
  const missing = [...strings, ...numbers].filter(key => housing[key] == null).map(key => `housing.${key}`);
  if (body.safetyBufferCents == null) missing.push("safetyBufferCents");
  if (missing.length) throw new InputError("Please supply the missing details; confirm zero costs explicitly.", missing);
  if (Object.keys(housing).some(key => ![...strings, ...numbers, "eligibleForStudentBusFare"].includes(key))) {
    throw new InputError("Unsupported housing field.");
  }
  for (const key of strings) {
    if (typeof housing[key] !== "string" || !(housing[key] as string).trim() || (housing[key] as string).length > 200) {
      throw new InputError(`Invalid housing.${key}.`);
    }
  }
  for (const key of numbers) {
    const amount = housing[key];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0
      || (key !== "monthlyApartmentRentDollars" && !Number.isSafeInteger(amount))) {
      throw new InputError(`Invalid housing.${key}.`);
    }
  }
  if (!Number.isSafeInteger(body.safetyBufferCents) || (body.safetyBufferCents as number) < 0) {
    throw new InputError("Safety buffer must be non-negative integer cents.");
  }
  const excluded = body.excludedBillIds ?? [];
  if (!Array.isArray(excluded) || excluded.length > 100 || excluded.some(id => typeof id !== "string" || id.length > 100)) {
    throw new InputError("excludedBillIds must be a list of bill IDs.");
  }
  return { housing: housing as unknown as CampusHousingRequest,
    safetyBufferCents: body.safetyBufferCents as number, excludedBillIds: excluded as string[] };
}

/** Create a local service for the forthcoming ACP bridge; inject fetch for tests. */
export function createFinanceServer(config: DemoServerConfig, fetchData: NessieDataFetcher) {
  if (!config.token || config.token.length < 32) throw new Error("Use a bridge token of at least 32 characters.");
  if (!config.customerId || !config.historyStartDate || !config.asOfDate) throw new Error("Missing sandbox server configuration.");
  return createServer(async (req, res) => {
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(payload));
    };
    // Check the bridge credential before reading input or fetching banking data.
    const provided = Buffer.from(req.headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${config.token}`);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      send(401, { error: "Unauthorized" }); return;
    }
    if (req.url !== "/api/demo/affordability") { send(404, { error: "Not found" }); return; }
    if (req.method !== "POST") { send(405, { error: "Use POST" }); return; }
    if (!req.headers["content-type"]?.startsWith("application/json")) {
      send(415, { error: "Use application/json" }); return;
    }
    try {
      // Bound memory and reject malformed JSON before invoking any tools.
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        const bytes = Buffer.from(chunk);
        size += bytes.length;
        if (size > 16_384) { send(413, { error: "Request too large" }); return; }
        chunks.push(bytes);
      }
      let input: unknown;
      try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
      catch { throw new InputError("Invalid JSON."); }
      const request = parseRequest(input);
      let campus;
      try { campus = await buildCampusHousingScenario(request.housing); }
      catch { throw new InputError("Invalid campus or housing details. Check dates, costs, sharing, and bus eligibility."); }
      const days = Math.round((Date.parse(`${request.housing.leaseEnd}T00:00:00Z`)
        - Date.parse(`${config.asOfDate}T00:00:00Z`)) / 86_400_000) - 1;
      if (request.housing.leaseStart <= config.asOfDate || days < 1 || days > 366) {
        throw new InputError("Lease must start after the snapshot date and end within the supported 366-day forecast.");
      }
      let data;
      try { data = await fetchData(config.customerId, config.accountId); }
      catch { send(502, { error: "Banking data is unavailable. Please retry." }); return; }
      if (request.excludedBillIds.some(id => !data.bills.some(bill => bill.id === id))) {
        throw new InputError("An excluded bill was not found in the demo account.");
      }
      // Preserve data-quality warnings and select ML only when evaluation supports it.
      const { profile, warnings } = adaptNessieData(data, {
        asOfDate: config.asOfDate, historyStartDate: config.historyStartDate,
        safetyBufferCents: request.safetyBufferCents, excludedBillIds: request.excludedBillIds,
      });
      const { forecast, evaluation } = selectSpendingForecast(profile, days);
      const affordability = evaluateAffordability(profile, campus.scenario, { spendingForecast: forecast });
      affordability.assumptions.push(...campus.assumptions);
      send(200, {
        mode: "sandbox-demo", snapshotDate: config.asOfDate,
        toolCalls: ["buildCampusHousingScenario", "getStudentFinancialData", "adaptNessieData",
          "selectSpendingForecast", "evaluateAffordability"],
        affordability, predictionMethod: forecast.method, evaluation, dataWarnings: warnings,
        // No raw transactions, credentials, or account identifiers in responses.
      });
    } catch (error) {
      if (error instanceof InputError) send(422, { error: error.message, missingFields: error.missingFields });
      else send(500, { error: "Unable to evaluate the demo data. Check server configuration and data coverage." });
    }
  });
}
