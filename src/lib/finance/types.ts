/** All monetary values are integer cents. Dates use YYYY-MM-DD. */
export type MoneyCents = number;
export type ISODate = string;

export interface Transaction {
  id: string;
  date: ISODate;
  /** Positive amount; direction determines whether money enters or leaves. */
  amountCents: MoneyCents;
  direction: "income" | "expense";
  category: string;
  description: string;
  /** Only variable expenses are used to train the spending predictor. */
  spendingType: "variable" | "scheduled";
}

export interface ScheduledCashFlow {
  id: string;
  label: string;
  date: ISODate;
  amountCents: MoneyCents;
  direction: "income" | "expense";
  certainty: "confirmed" | "estimated";
}

export interface FinancialProfile {
  asOfDate: ISODate;
  availableBalanceCents: MoneyCents;
  safetyBufferCents: MoneyCents;
  /** Complete observation window, including dates with no transactions. */
  historyStartDate: ISODate;
  transactions: Transaction[];
  /** Future income and expenses, excluding housing costs in the scenario. */
  scheduledCashFlows: ScheduledCashFlow[];
}

export interface HousingScenario {
  name: string;
  leaseStart: ISODate;
  leaseEnd: ISODate;
  /** All costs represent this student's share. */
  monthlyRentCents: MoneyCents;
  monthlyUtilitiesCents: MoneyCents;
  monthlyInternetCents: MoneyCents;
  monthlyInsuranceCents: MoneyCents;
  monthlyParkingCents: MoneyCents;
  monthlyCommuteCents: MoneyCents;
  securityDepositCents: MoneyCents;
  applicationFeesCents: MoneyCents;
  movingCostsCents: MoneyCents;
}

export interface SpendingPrediction {
  date: ISODate;
  predictedCents: MoneyCents;
  lowerEstimateCents: MoneyCents;
  upperEstimateCents: MoneyCents;
}

/** A common output contract for the baseline and future ML predictor. */
export interface SpendingForecast {
  method: "baseline" | "machine-learning";
  predictions: SpendingPrediction[];
  assumptions: string[];
}

export interface DailyBalanceForecast {
  date: ISODate;
  projectedBalanceCents: MoneyCents;
  belowSafetyBuffer: boolean;
}

export interface AffordabilityResult {
  monthlyHousingCostCents: MoneyCents;
  /** Includes first month's rent; do not deduct it twice in the forecast. */
  upfrontCashRequiredCents: MoneyCents;
  dailyBalances: DailyBalanceForecast[];
  assumptions: string[];
  warnings: string[];
}

/** Simulation frequencies describe modeled scenarios, not guaranteed outcomes. */
export interface SimulationResult {
  scenarioCount: number;
  fractionBelowSafetyBuffer: number;
  assumptions: string[];
}
