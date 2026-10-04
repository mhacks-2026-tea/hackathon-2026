import {
  dashboardMockData,
  mockAssistantReplies,
} from "@/lib/mock-data";
import type {
  AffordabilityResult,
  ChatMessage,
  DashboardData,
  HousingQuery,
  HousingScenario,
} from "@/lib/types";
import { getDashboardDataForCampus } from "@/lib/frontend/campus-data";
import type {
  CampusDashboardData,
  CampusId,
} from "@/lib/frontend/campus-types";

function waitForMockResponse(delay: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(amount: number): string {
  return currency.format(amount);
}

export async function getDashboardData(
  campusId: CampusId,
): Promise<CampusDashboardData> {
  return getDashboardDataForCampus(campusId);
}

export async function simulateHousingDecision(
  query: HousingQuery,
  data: DashboardData = dashboardMockData,
): Promise<AffordabilityResult> {
  await waitForMockResponse(420);
  const estimate = data.rentEstimates.find(
    (item) => item.monthlyRent === query.monthlyRent,
  );
  if (!estimate) {
    const supportedRents = data.rentEstimates
      .map((item) => item.monthlyRent)
      .join(", $");
    throw new RangeError(
      `The preview has estimates for $${supportedRents}.`,
    );
  }
  return estimate.result;
}

export async function estimateHousingScenario(
  query: HousingQuery,
  data: DashboardData = dashboardMockData,
): Promise<HousingScenario> {
  await waitForMockResponse(320);

  if (!Number.isInteger(query.monthlyRent) || query.monthlyRent < 200 || query.monthlyRent > 5000) {
    throw new RangeError("Enter a rent between $200 and $5,000.");
  }
  if (!Number.isInteger(query.roommates) || query.roommates < 0 || query.roommates > 3) {
    throw new RangeError("Choose between 0 and 3 roommates.");
  }
  if (
    query.utilities !== undefined &&
    (!Number.isFinite(query.utilities) || query.utilities < 0 || query.utilities > 2000)
  ) {
    throw new RangeError("Enter utilities between $0 and $2,000.");
  }
  if (
    query.parking !== undefined &&
    (!Number.isFinite(query.parking) || query.parking < 0 || query.parking > 1000)
  ) {
    throw new RangeError("Enter parking between $0 and $1,000.");
  }
  const presetScenario = data.scenarios.find(
    (scenario) =>
      scenario.monthlyRent === query.monthlyRent &&
      scenario.roommates === query.roommates,
  );
  if (
    presetScenario &&
    query.utilities === undefined &&
    query.parking === undefined &&
    query.leaseStart === undefined
  ) {
    return presetScenario;
  }

  const base = data.affordability;
  const people = query.roommates + 1;
  const breakdown = {
    ...base.breakdown,
    rent: Math.round(query.monthlyRent / people),
    utilities: Math.round((query.utilities ?? base.breakdown.utilities) / people),
    internet: Math.round(base.breakdown.internet / people),
    insurance: Math.round(base.breakdown.insurance / people),
    parking: query.parking ?? base.breakdown.parking,
  };
  breakdown.total =
    breakdown.rent +
    breakdown.utilities +
    breakdown.internet +
    breakdown.insurance +
    breakdown.parking +
    breakdown.transportation;

  const monthlyRemaining =
    base.monthlyRemaining + base.trueMonthlyCost - breakdown.total;
  const monthlySavings = base.trueMonthlyCost - breakdown.total;
  const leaseMonth = query.leaseStart?.split("-")[1];
  const monthNumber = leaseMonth ? Number(leaseMonth) : 7;
  const monthIndexes: Record<number, number> = {
    5: 0,
    6: 1,
    7: 2,
    8: 3,
    9: 4,
    10: 5,
    11: 6,
    12: 7,
  };
  if (query.leaseStart && monthIndexes[monthNumber] === undefined) {
    throw new RangeError("The sample projection covers lease starts from May through December.");
  }
  const firstAffectedMonth = monthIndexes[monthNumber] ?? 2;
  const cashFlow = data.cashFlow.map((point, index) => {
    const projectedBalance = Math.max(
      0,
      point.projectedBalance +
        monthlySavings * Math.max(0, index - firstAffectedMonth + 1),
    );
    return {
      ...point,
      projectedBalance,
      distanceFromBuffer: projectedBalance - base.safetyBuffer,
    };
  });
  const riskMonths = cashFlow
    .filter((point) => point.distanceFromBuffer < 0)
    .map((point) => point.month === "Jul" ? "July" : point.month === "Aug" ? "August" : point.month);
  const status =
    riskMonths.length === 0
      ? "comfortable"
      : monthlyRemaining < base.monthlyRemaining - 100
        ? "risky"
        : "tight";
  const sampleRoommateSavings =
    data.scenarios.find((scenario) => scenario.id === "roommate")?.savingsVsSolo ?? 0;
  const roommateCount = query.roommates + 2;
  const nextRoommateCost =
    Math.round(query.monthlyRent / roommateCount) +
    Math.round((query.utilities ?? base.breakdown.utilities) / roommateCount) +
    Math.round(base.breakdown.internet / roommateCount) +
    Math.round(base.breakdown.insurance / roommateCount) +
    (query.parking ?? base.breakdown.parking) +
    base.breakdown.transportation;
  const roommateSavings =
    query.monthlyRent === base.breakdown.rent && query.roommates === 0
      ? sampleRoommateSavings
      : Math.max(0, breakdown.total - nextRoommateCost);
  const result: AffordabilityResult = {
    ...base,
    status,
    summary: `Here's what a ${formatMoney(query.monthlyRent)} apartment would really cost you${query.roommates ? ` with ${query.roommates} roommate${query.roommates === 1 ? "" : "s"}` : ""}.`,
    monthlyRemaining,
    trueMonthlyCost: breakdown.total,
    riskMonths,
    breakdown,
    explanation: `Your estimated share is ${formatMoney(breakdown.total)} each month, including rent, utilities, internet, insurance, parking, and transportation.`,
    recommendation:
      query.roommates > 0
        ? "Compare the monthly estimate with your projected balance before choosing a lease."
        : `A roommate could add ${formatMoney(roommateSavings)} each month in breathing room.`,
  };

  return {
    id: `custom-${query.monthlyRent}-${query.roommates}`,
    title: query.roommates
      ? `Off-campus, ${query.roommates} roommate${query.roommates === 1 ? "" : "s"}`
      : "Off-campus, alone",
    monthlyRent: query.monthlyRent,
    roommates: query.roommates,
    monthlyCost: breakdown.total,
    monthlyRemaining,
    savingsVsSolo: base.trueMonthlyCost - breakdown.total,
    status,
    result,
    cashFlow,
  };
}

export interface MockAssistantResponse extends ChatMessage {
  scenarioId: string;
}

export async function sendMockAssistantMessage(
  prompt: string,
): Promise<MockAssistantResponse> {
  await waitForMockResponse(520);
  const normalizedPrompt = prompt.toLowerCase();
  const reply = normalizedPrompt.includes("roommate")
    ? mockAssistantReplies.roommate
    : normalizedPrompt.includes("august") ||
        normalizedPrompt.includes("summer")
      ? mockAssistantReplies.august
      : mockAssistantReplies.default;

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content: reply.text,
    createdAt: "Now",
    scenarioId: reply.scenarioId,
  };
}
