import { dashboardMockData, campusProfiles } from "@/lib/mock-data";
import type {
  CampusDashboardData,
  CampusId,
  FrontendCampusProfile,
  Listing,
} from "@/lib/frontend/campus-types";
import type {
  AffordabilityResult,
  CashFlowPoint,
  HousingScenario,
} from "@/lib/types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function getCampusProfile(id: string): FrontendCampusProfile {
  const profile = campusProfiles.find((campus) => campus.id === id);
  if (!profile) {
    throw new RangeError(`Unknown campus "${id}".`);
  }
  return profile;
}

function resultForRent(
  base: AffordabilityResult,
  monthlyRent: number,
  profile: FrontendCampusProfile,
): AffordabilityResult {
  const breakdown = {
    ...base.breakdown,
    rent: monthlyRent,
    utilities: profile.costOfLiving.utilities,
    internet: profile.costOfLiving.internet,
    insurance: profile.costOfLiving.insurance,
    parking: profile.costOfLiving.parking,
    transportation: profile.costOfLiving.transportation,
  };
  breakdown.total =
    breakdown.rent +
    breakdown.utilities +
    breakdown.internet +
    breakdown.insurance +
    breakdown.parking +
    breakdown.transportation;
  const monthlyRemaining =
    dashboardMockData.affordability.monthlyRemaining +
    dashboardMockData.affordability.trueMonthlyCost -
    breakdown.total;
  const status = monthlyRemaining >= 650
    ? "comfortable"
    : monthlyRemaining >= 350
      ? "tight"
      : "risky";

  return {
    ...base,
    status,
    summary: `At ${currency.format(monthlyRent)} rent near ${profile.shortName}, here is what to plan around.`,
    trueMonthlyCost: breakdown.total,
    monthlyRemaining,
    riskMonths: status === "comfortable" ? [] : ["July", "August"],
    explanation: `Your estimated monthly housing cost near ${profile.shortName} includes rent, utilities, internet, insurance, parking, and ${profile.transit}.`,
    recommendation: status === "comfortable"
      ? "This example leaves room for your monthly expenses and summer plans."
      : "Compare a lower rent or a roommate before choosing a lease.",
    breakdown,
  };
}

export function estimateListingAffordability(
  listing: Listing,
  profile: FrontendCampusProfile,
): AffordabilityResult {
  return resultForRent(dashboardMockData.affordability, listing.rent, profile);
}

function cashFlowForRent(
  rent: number,
  profile: FrontendCampusProfile,
): CashFlowPoint[] {
  const monthlyDelta = rent - profile.rentBenchmarks.typical;
  return dashboardMockData.cashFlow.map((point, index) => {
    const calendarEvent = profile.calendar.find(
      (event) => event.month === point.month,
    );
    const projectedBalance = Math.max(
      0,
      point.projectedBalance - monthlyDelta * Math.max(0, index - 1),
    );
    return {
      ...point,
      projectedBalance,
      distanceFromBuffer: projectedBalance - dashboardMockData.financials.safetyBuffer,
      event: calendarEvent?.label,
      eventKind: calendarEvent?.kind,
    };
  });
}

function makeScenario(
  id: string,
  title: string,
  monthlyRent: number,
  roommates: number,
  profile: FrontendCampusProfile,
  baseResult: AffordabilityResult,
): HousingScenario {
  const result = resultForRent(
    baseResult,
    Math.round(monthlyRent / (roommates + 1)),
    profile,
  );
  const cashFlow = cashFlowForRent(monthlyRent, profile);
  const riskMonths = cashFlow
    .filter((point) => point.distanceFromBuffer < 0)
    .map((point) => point.month);
  result.riskMonths = riskMonths.map((month) => fullMonthName[month] ?? month);
  return {
    id,
    title,
    monthlyRent,
    roommates,
    monthlyCost: result.trueMonthlyCost,
    monthlyRemaining: result.monthlyRemaining,
    savingsVsSolo: profile.rentBenchmarks.typical - result.trueMonthlyCost,
    status: result.status,
    result,
    cashFlow,
  };
}

const fullMonthName: Record<string, string> = {
  Jul: "July",
  Aug: "August",
  Sep: "September",
};

export function getCampusDashboardData(id: CampusId): CampusDashboardData {
  const campus = getCampusProfile(id);
  const base = dashboardMockData;
  const affordability = resultForRent(
    base.affordability,
    campus.rentBenchmarks.typical,
    campus,
  );
  const cashFlow = cashFlowForRent(campus.rentBenchmarks.typical, campus);
  affordability.riskMonths = cashFlow
    .filter((point) => point.distanceFromBuffer < 0)
    .map((point) => fullMonthName[point.month] ?? point.month);

  const rentEstimates = [
    campus.rentBenchmarks.low,
    campus.rentBenchmarks.typical,
    campus.rentBenchmarks.high,
  ].map((monthlyRent) => ({
    monthlyRent,
    result: resultForRent(base.affordability, monthlyRent, campus),
  }));

  const scenarios = [
    makeScenario(
      "solo",
      "Off-campus, alone",
      campus.rentBenchmarks.typical,
      0,
      campus,
      base.affordability,
    ),
    makeScenario(
      "roommate",
      "Off-campus, shared",
      Math.round(campus.rentBenchmarks.typical * 1.03),
      1,
      campus,
      base.affordability,
    ),
    makeScenario(
      "campus",
      "University housing",
      Math.round(campus.rentBenchmarks.typical * 1.13),
      0,
      campus,
      base.affordability,
    ),
  ];

  return {
    campus,
    financials: base.financials,
    affordability,
    cashFlow,
    rentEstimates,
    scenarios,
    neighborhoods: campus.neighborhoods.map((neighborhood) => {
      const result = resultForRent(
        base.affordability,
        neighborhood.typicalRent,
        campus,
      );
      return {
        id: neighborhood.id,
        name: neighborhood.name,
        typicalRent: neighborhood.typicalRent,
        estimatedMonthlyCost: result.trueMonthlyCost,
        commute: neighborhood.commute,
        note: neighborhood.note,
        studentFit: neighborhood.studentFit,
        status: result.status,
      };
    }),
  } satisfies CampusDashboardData;
}

export function getDashboardDataForCampus(
  id: CampusId,
): Promise<CampusDashboardData> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(getCampusDashboardData(id)), 180);
  });
}
