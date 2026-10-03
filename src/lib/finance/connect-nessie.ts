import type { HousingScenario } from "./types";
import type { NessieAdapterInput, NessieAdapterOptions } from "./nessie-adapter.ts";
import { adaptNessieData } from "./nessie-adapter.ts";
import type { AffordabilityOptions } from "./affordability.ts";
import { evaluateAffordability } from "./affordability.ts";

/** Haarun's existing getStudentFinancialData function satisfies this contract. */
export type NessieDataFetcher = (
  customerId: string,
  accountId?: string,
) => Promise<NessieAdapterInput>;

/** Inputs supplied by the server route after verifying user/account access. */
export interface NessieAffordabilityRequest {
  customerId: string;
  accountId?: string;
  housing: HousingScenario;
  financialContext: NessieAdapterOptions;
  forecastOptions?: AffordabilityOptions;
}

/**
 * Server-side bridge: fetch banking data, convert it, then evaluate housing.
 * Pass Haarun's function rather than copying his implementation into this branch.
 * His function continues to own API keys, authentication, and network errors.
 * The calling route must authorize customer/account IDs before invoking this.
 */
export async function evaluateNessieAffordability(
  fetchFinancialData: NessieDataFetcher,
  request: NessieAffordabilityRequest,
) {
  // Never allow banking data to be fetched or analyzed in a browser component.
  if (typeof window !== "undefined") {
    throw new Error("Nessie affordability must run on the server.");
  }

  // Let fetch failures propagate; an outage must not look like empty history.
  const bankingData = await fetchFinancialData(request.customerId, request.accountId);
  const { profile, warnings: dataWarnings } = adaptNessieData(
    bankingData,
    request.financialContext,
  );
  const affordability = evaluateAffordability(
    profile,
    request.housing,
    request.forecastOptions,
  );

  // Return conversion warnings alongside the result. Do not return the raw
  // financial history to the frontend just to display an affordability card.
  return { affordability, dataWarnings };
}
