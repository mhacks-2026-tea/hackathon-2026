export type AffordabilityStatus = "comfortable" | "tight" | "risky";

export interface CampusProfile {
  id: string;
  name: string;
  city: string;
  term: string;
}

export interface FinancialSummary {
  currentBalance: number;
  monthlyIncome: number;
  monthlySpending: number;
  safetyBuffer: number;
}

export interface CashFlowPoint {
  month: string;
  projectedBalance: number;
  distanceFromBuffer: number;
  event?: string;
  eventKind?: "warning" | "move-in" | "positive";
}

export interface HousingCostBreakdown {
  rent: number;
  utilities: number;
  internet: number;
  insurance: number;
  parking: number;
  transportation: number;
  total: number;
}

export interface HousingScenario {
  comparisons?: HousingScenario[];
  query?: HousingQuery;
  id: string;
  title: string;
  monthlyRent: number;
  roommates: number;
  monthlyCost: number;
  monthlyRemaining: number;
  savingsVsSolo: number;
  status: AffordabilityStatus;
  result: AffordabilityResult;
  cashFlow: CashFlowPoint[];
}

export interface AffordabilityResult {
  upfrontCashRequired?: number;
  status: AffordabilityStatus;
  summary: string;
  monthlyRemaining: number;
  trueMonthlyCost: number;
  safetyBuffer: number;
  riskMonths: string[];
  explanation: string;
  recommendation: string;
  breakdown: HousingCostBreakdown;
}

export interface Neighborhood {
  id: string;
  name: string;
  typicalRent: number;
  estimatedMonthlyCost: number;
  commute: string;
  note: string;
  studentFit: string;
  status: AffordabilityStatus;
}

export interface DashboardData {
  assistantMode?: 'asi' | 'offline';
  source?: string;
  notices?: string[];
  campus: CampusProfile;
  financials: FinancialSummary;
  cashFlow: CashFlowPoint[];
  affordability: AffordabilityResult;
  rentEstimates: HousingEstimate[];
  scenarios: HousingScenario[];
  neighborhoods: Neighborhood[];
}

export interface HousingEstimate {
  monthlyRent: number;
  result: AffordabilityResult;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  scenarioId?: string;
}

export interface HousingQuery {
  monthlyRent: number;
  roommates: number;
  utilities?: number;
  parking?: number;
  leaseStart?: string;
}
