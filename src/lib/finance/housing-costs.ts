import type { HousingScenario, MoneyCents } from "./types.ts";

/** Total monthly housing expenses for the student's share, in cents. */
export function calculateMonthlyHousingCost(
  scenario: HousingScenario,
  month = scenario.leaseStart.slice(5, 7),
): MoneyCents {
  const seasonal = scenario.monthlyUtilitiesByMonthCents;
  if (seasonal) {
    for (let index = 1; index <= 12; index++) {
      const amount = seasonal[String(index).padStart(2, "0")];
      if (!Number.isSafeInteger(amount) || amount < 0) {
        throw new Error("Seasonal utilities require non-negative integer cents for all 12 months.");
      }
    }
    if (!/^(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid utility month.");
  }
  // Recurring expenses are separate from one-time move-in costs.
  const costs = [
    scenario.monthlyRentCents,
    seasonal ? seasonal[month] : scenario.monthlyUtilitiesCents,
    scenario.monthlyInternetCents,
    scenario.monthlyInsuranceCents,
    scenario.monthlyParkingCents,
    scenario.monthlyCommuteCents,
  ];

  // Reject fractions of a cent, negative amounts, and invalid numbers.
  for (const cost of costs) {
    if (!Number.isSafeInteger(cost) || cost < 0) {
      throw new Error("Monthly housing costs must be non-negative integer cents.");
    }
  }

  // Sum in cents to avoid rounding errors from decimal dollar amounts.
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  // Each input can be valid while their combined total is too large.
  if (!Number.isSafeInteger(total)) {
    throw new Error("Monthly housing cost total exceeds the supported range.");
  }
  return total;
}

/**
 * Cash needed for the student's move-in: first month's rent, deposit,
 * application fees, and moving costs. Monthly utilities are not included.
 * The deposit is included because the student needs that cash upfront,
 * even if it may be refunded later.
 */
export function calculateUpfrontCashRequired(
  scenario: HousingScenario,
): MoneyCents {
  // Include the first rent payment once. The forecast must not deduct
  // it again if it already deducts this upfront total.
  const costs = [
    scenario.monthlyRentCents,
    scenario.securityDepositCents,
    scenario.applicationFeesCents,
    scenario.movingCostsCents,
  ];

  // Validate only the fields needed for this calculation.
  for (const cost of costs) {
    if (!Number.isSafeInteger(cost) || cost < 0) {
      throw new Error("Move-in costs must be non-negative integer cents.");
    }
  }

  // Return the total cash requirement in integer cents.
  const total = costs.reduce((sum, cost) => sum + cost, 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error("Move-in cost total exceeds the supported range.");
  }
  return total;
}
