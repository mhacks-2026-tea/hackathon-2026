"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  CircleHelp,
  Home,
  Info,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { ListingCards } from "@/components/listing-cards";
import { MovinBrandMark } from "@/components/movin-brand-mark";
import { CampusAtmosphere } from "@/components/campus-atmosphere";
import { SchoolMark } from "@/components/school-mark";
import { StatusText } from "@/components/status-text";
import {
  estimateHousingScenario,
  getDashboardData,
  sendAssistantMessage,
} from "@/lib/data/dashboard";
import { campusProfiles, mockPrompts } from "@/lib/mock-data";
import type {
  CampusDashboardData,
  CampusId,
  CampusTheme,
} from "@/lib/frontend/campus-types";
import type {
  AffordabilityResult,
  ChatMessage,
  DashboardData,
  HousingCostBreakdown,
  HousingEstimate,
  HousingScenario,
} from "@/lib/types";

export type DashboardView = "overview" | "housing" | "ask" | "neighborhoods";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: Home, view: "overview" },
  { href: "/housing", label: "Housing", icon: Building2, view: "housing" },
  { href: "/ask", label: "Ask Movin", icon: MessageCircle, view: "ask" },
  { href: "/neighborhoods", label: "Neighborhoods", icon: MapPin, view: "neighborhoods" },
] as const;

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatMoney(amount: number): string {
  return currency.format(amount);
}

function formatRentInput(amount: number): string {
  return formatMoney(amount).replace("$", "");
}

type CampusThemeStyle = CSSProperties & Record<`--${string}`, string>;

function getCampusThemeStyle(theme: CampusTheme): CampusThemeStyle {
  return {
    "--background": theme.background,
    "--surface": theme.surface,
    "--surface-soft": theme.surfaceSoft,
    "--foreground": theme.foreground,
    "--muted": theme.muted,
    "--muted-strong": theme.mutedStrong,
    "--border": theme.border,
    "--border-strong": theme.borderStrong,
    "--primary": theme.primary,
    "--primary-dark": theme.primaryDark,
    "--primary-wash": theme.primaryWash,
    "--primary-light": theme.primaryLight,
    "--text-on-primary": theme.textOnPrimary,
    "--accent": theme.accent,
    "--focus-ring": theme.focusRing,
    "--success": theme.success,
    "--success-wash": theme.successWash,
    "--warning": theme.warning,
    "--warning-wash": theme.warningWash,
    "--danger": theme.danger,
    "--danger-wash": theme.dangerWash,
    "--chart-grid": theme.chartGrid,
    colorScheme: theme.colorScheme,
  };
}

function isCampusId(value: string | null): value is CampusId {
  return campusProfiles.some((campus) => campus.id === value);
}

const fullMonthName: Record<string, string> = {
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

function AppNavigation({
  view,
  campusId,
}: {
  view: DashboardView;
  campusId: CampusId;
}) {
  return (
    <nav className="primary-navigation" aria-label="Main navigation">
      {navItems.map(({ href, label, icon: Icon, view: itemView }) => (
        <Link
          aria-current={view === itemView ? "page" : undefined}
          className={`top-tab${view === itemView ? " top-tab-active" : ""}`}
          href={`${href}?campus=${campusId}`}
          key={href}
        >
          <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function CampusSelector({
  data,
  onSelect,
}: {
  data: CampusDashboardData;
  onSelect: (id: CampusId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const optionsId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="campus-selector-wrap">
      <button
        aria-label={`${data.campus.name}, ${data.campus.city}. Select campus`}
        aria-controls={optionsId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="campus-selector"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <SchoolMark
          campus={data.campus}
          className="campus-mark campus-mark-small"
        />
        <span className="campus-copy">
          <span>{data.campus.shortName}</span>
          <small>{data.campus.city}, {data.campus.state}</small>
        </span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {isOpen && (
        <div
          className="campus-options"
          id={optionsId}
          role="menu"
          aria-label="Choose your campus"
        >
          {campusProfiles.map((campus) => (
            <button
              aria-checked={data.campus.id === campus.id}
              className="campus-option"
              key={campus.id}
              onClick={() => {
                onSelect(campus.id);
                setIsOpen(false);
              }}
              role="menuitemradio"
              type="button"
            >
              <SchoolMark
                campus={campus}
                className="campus-mark"
              />
              <span className="campus-option-copy">
                <strong>{campus.name}</strong>
                <small>{campus.city}, {campus.state}</small>
              </span>
              {data.campus.id === campus.id && <BadgeCheck size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AccountMenu({
  data,
  onCampusChange,
}: {
  data: CampusDashboardData;
  onCampusChange: (id: CampusId) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <div className="account-menu-wrap">
      <button
        aria-label="Open account menu for Alex · demo account"
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="account-button"
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <span className="avatar" aria-hidden="true">AX</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="account-menu" id={menuId} role="menu" aria-label="Account">
          <div className="account-menu-identity">
            <strong>Alex · demo account</strong>
            <span>Sandbox demo account</span>
          </div>
          <div className="mobile-campus-selector">
            <CampusSelector data={data} onSelect={onCampusChange} />
          </div>
          <button className="sign-out-placeholder" disabled role="menuitem" type="button">
            Sign out <span>Preview only</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AppShell({
  children,
  data,
  view,
  onCampusChange,
  campusNotice,
  onUndoCampusChange,
  onDismissCampusNotice,
}: {
  children: ReactNode;
  data: CampusDashboardData;
  view: DashboardView;
  onCampusChange: (id: CampusId) => void;
  campusNotice: string | null;
  onUndoCampusChange: () => void;
  onDismissCampusNotice: () => void;
}) {
  return (
    <div
      className="app-frame"
      data-campus={data.campus.id}
      style={getCampusThemeStyle(data.campus.theme)}
    >
      <CampusAtmosphere campus={data.campus} />
      <header className="topbar">
        <div className="topbar-inner">
          <Link
            className="wordmark"
            href={`/dashboard?campus=${data.campus.id}`}
            aria-label="Movin overview"
          >
            <MovinBrandMark className="brand-school-mark" />
            <span className="brand-name">movin</span>
          </Link>
          <AppNavigation view={view} campusId={data.campus.id} />
          <div className="topbar-actions">
            <CampusSelector data={data} onSelect={onCampusChange} />
            <AccountMenu data={data} onCampusChange={onCampusChange} />
          </div>
        </div>
      </header>
      <main className={`app-main page-${view}`}>
        <div className="page-content">{children}</div>
      </main>
      {campusNotice && (
        <div className="campus-toast" role="status" aria-live="polite">
          <span>{campusNotice}</span>
          <button className="campus-toast-undo" onClick={onUndoCampusChange} type="button">
            Undo
          </button>
          <button
            aria-label="Dismiss campus change message"
            className="campus-toast-dismiss"
            onClick={onDismissCampusNotice}
            type="button"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function LoadState({
  error,
  retry,
}: {
  error: string | null;
  retry: () => void;
}) {
  if (error) {
    return (
      <main className="load-state">
        <CircleHelp size={24} aria-hidden="true" />
        <h1>We couldn’t load your financial summary.</h1>
        <p>{error}</p>
        <button className="action-button" onClick={retry} type="button">
          Try again
        </button>
      </main>
    );
  }

  return (
    <main className="page-content loading-content" aria-label="Loading your dashboard">
      <div className="skeleton skeleton-greeting" />
      <div className="skeleton skeleton-answer" />
      <div className="skeleton skeleton-chart" />
      <span className="sr-only" role="status">
        Loading your financial summary.
      </span>
    </main>
  );
}

function HeroAnswer({
  data,
  result,
  overview = false,
  busy = false,
}: {
  data: DashboardData;
  result: AffordabilityResult;
  overview?: boolean;
  busy?: boolean;
}) {
  const costs = [
    { label: "Rent", amount: result.breakdown.rent },
    { label: "Utilities", amount: result.breakdown.utilities },
    { label: "Internet", amount: result.breakdown.internet },
    { label: "Renters insurance", amount: result.breakdown.insurance },
    { label: "Parking", amount: result.breakdown.parking },
    { label: "Transportation", amount: result.breakdown.transportation },
  ];
  const riskLabel = overview
    ? result.status === "comfortable"
      ? "Your balance stays above its safety cushion"
      : result.status === "tight"
        ? `Tight in ${result.riskMonths.join(" and ")}`
        : `At risk in ${result.riskMonths.join(" and ")}`
    : result.riskMonths.length
      ? `Tight in ${result.riskMonths.join(" and ")}`
      : "Comfortable through the year";

  if (!overview) {
    const legacyCosts = costs;
    return (
      <section className="answer-section" aria-labelledby="answer-title">
        <div className="answer-primary" aria-live="polite">
          <StatusText status={result.status}>{riskLabel}</StatusText>
          <h2 className="hero-amount" id="answer-title">
            {formatMoney(result.trueMonthlyCost)}
            <span> / month</span>
          </h2>
          <p className="hero-caption">true monthly cost of a {formatMoney(result.breakdown.rent)} apartment</p>
        </div>
        <div className="cost-ledger" aria-label="Monthly housing cost breakdown">
          <div
            className="cost-bar"
            role="img"
            aria-label={`${formatMoney(result.breakdown.rent)} rent grows to ${formatMoney(result.trueMonthlyCost)} with other housing costs`}
          >
            {legacyCosts.map(({ label, amount }) => (
              <span
                className={`cost-bar-${label === "Renters insurance" ? "insurance" : label === "Transportation" ? "transport" : label.toLowerCase()}`}
                key={label}
                style={{ flexGrow: amount }}
              />
            ))}
          </div>
          <div className="ledger-rows">
            {legacyCosts.map(({ label, amount }, index) => (
              <div className="ledger-row" key={label}>
                <span>{label}</span>
                <span>{index === 0 ? "" : "+"} {formatMoney(amount)}</span>
              </div>
            ))}
          </div>
          <div className="ledger-total">
            <span>True monthly cost</span>
            <strong>{formatMoney(result.trueMonthlyCost)}</strong>
          </div>
          <div className="ledger-remaining">
            <span>Left after housing</span>
            <strong>{formatMoney(result.monthlyRemaining)}</strong>
          </div>
        </div>
        <p className="answer-takeaway">
          A roommate would add{" "}
          <strong>{formatMoney(data.scenarios.find((scenario) => scenario.id === "roommate")?.savingsVsSolo ?? 0)} a month in breathing room.</strong>
          <Link href="/housing">
            Compare options <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section
      className={`answer-section overview-answer-section${busy ? " answer-section-busy" : ""}`}
      aria-labelledby="answer-title"
      aria-busy={busy}
      aria-live="polite"
    >
      {busy ? (
        <div className="verdict-skeleton" role="status" aria-label="Updating your estimate">
          <span />
          <span />
          <span />
        </div>
      ) : (
        <>
          <div className="answer-primary">
            <h2 id="answer-title">Can you afford it?</h2>
            <StatusText status={result.status}>{riskLabel}</StatusText>
            <p className="hero-amount">
              {formatMoney(result.trueMonthlyCost)}
              <span> / month</span>
            </p>
            <p className="hero-caption">What you’d really pay each month</p>
            <p className="answer-leftover">
              {formatMoney(result.monthlyRemaining)} left each month after housing
            </p>
          </div>
          <div className="cost-ledger" aria-label="Monthly housing cost breakdown">
            <div
              className="cost-bar"
              role="img"
              aria-label={`Monthly costs total ${formatMoney(result.trueMonthlyCost)} including rent, utilities, internet, renters insurance, parking, and transportation`}
            >
              {costs.map(({ label, amount }) => (
                <span
                  className={`cost-bar-segment cost-segment-${label.toLowerCase().replaceAll(" ", "-")}`}
                  key={label}
                  style={{ flexGrow: amount }}
                />
              ))}
            </div>
            <div className="ledger-rows">
              {costs.map(({ label, amount }) => (
                <div className="ledger-row" key={label}>
                  <span className="ledger-label">
                    <span
                      aria-hidden="true"
                      className={`ledger-swatch cost-segment-${label.toLowerCase().replaceAll(" ", "-")}`}
                    />
                    {label}
                  </span>
                  <span>{formatMoney(amount)}</span>
                </div>
              ))}
            </div>
            <div className="ledger-total">
              <span>
                True monthly cost
                <details className="inline-help">
                  <summary aria-label="About true monthly cost"><Info size={15} /></summary>
                  <span>Rent plus utilities, internet, insurance, parking, and transportation.</span>
                </details>
              </span>
              <strong>{formatMoney(result.trueMonthlyCost)}</strong>
            </div>
            <details className="estimate-disclosure">
              <summary>How we estimate this</summary>
              <p>We add rent, utilities, internet, renters insurance, parking, and transportation using server financial history and the selected campus assumptions.</p>
            </details>
          </div>
          <p className="answer-takeaway">
            {result.recommendation}
            <a href="#options">Compare options <ArrowRight size={16} aria-hidden="true" /></a>
          </p>
        </>
      )}
    </section>
  );
}

function FinanceStrip({ data }: { data: DashboardData }) {
  const items = [
    { label: "Available balance", amount: data.financials.currentBalance, note: "Across your accounts" },
    { label: "Monthly income", amount: data.financials.monthlyIncome, note: "Average after taxes" },
    { label: "Typical spending", amount: data.financials.monthlySpending, note: "Last 3 months" },
    { label: "Safety cushion", amount: data.financials.safetyBuffer, note: "Minimum to keep" },
  ];

  return (
    <section className="finance-section" aria-labelledby="finance-title">
      <div className="section-heading">
        <h2 id="finance-title">Your money right now</h2>
        <p>What this estimate is based on.</p>
      </div>
      <div className="finance-strip" aria-label="Financial summary">
        {items.map(({ label, amount, note }) => (
          <div className="finance-item" key={label}>
            <span>
              {label}
              {label === "Safety cushion" && (
                <details className="inline-help">
                  <summary aria-label="About the safety cushion"><Info size={15} /></summary>
                  <span>The minimum balance you want to keep for unexpected costs.</span>
                </details>
              )}
            </span>
            <strong>{formatMoney(amount)}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <p className="sample-caption">
        <Info size={16} aria-hidden="true" />
        {data.source === "nessie-sandbox" ? "Nessie sandbox financial data" : "Alex demo · fictional financial inputs"}
      </p>
      <p className="safety-cushion-note">
        Your safety cushion is the minimum balance you want to keep for unexpected costs.
      </p>
    </section>
  );
}

function OverviewScenarioForm({
  data,
  rent,
  roommates,
  utilities,
  parking,
  leaseStart,
  isAnalyzing,
  error,
  onRentChange,
  onRoommatesChange,
  onUtilitiesChange,
  onParkingChange,
  onLeaseStartChange,
  onSubmit,
  onReset,
}: {
  data: DashboardData;
  rent: string;
  roommates: number;
  utilities: string;
  parking: string;
  leaseStart: string;
  isAnalyzing: boolean;
  error: string | null;
  onRentChange: (value: string) => void;
  onRoommatesChange: (value: number) => void;
  onUtilitiesChange: (value: string) => void;
  onParkingChange: (value: string) => void;
  onLeaseStartChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const rentInput = useRef<HTMLInputElement>(null);
  const parsedRent = Number(rent.replaceAll(",", ""));
  const invalidRent =
    !Number.isInteger(parsedRent) || parsedRent < 200 || parsedRent > 5000;
  const isDefaultScenario =
    parsedRent === data.affordability.breakdown.rent &&
    roommates === 0 &&
    !utilities &&
    !parking &&
    !leaseStart;

  useEffect(() => {
    function focusRent(event: globalThis.KeyboardEvent) {
      if (
        event.key === "/" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        rentInput.current?.focus();
      }
    }
    window.addEventListener("keydown", focusRent);
    return () => window.removeEventListener("keydown", focusRent);
  }, []);

  const exampleRent = data.neighborhoods[0]?.typicalRent;

  return (
    <section className="overview-scenario-section" aria-labelledby="scenario-form-title">
      <div className="section-heading">
        <h2 id="scenario-form-title">Start with a rent</h2>
        <p>Change the details to see how the estimate shifts.</p>
      </div>
      <form className="overview-scenario-form" onSubmit={onSubmit}>
        <div className="scenario-controls">
          <label className="scenario-rent-field" htmlFor="overview-rent">
            Monthly apartment rent
            <span className="overview-rent-input">
              <span aria-hidden="true">$</span>
              <input
                ref={rentInput}
                id="overview-rent"
                inputMode="numeric"
                onChange={(event) =>
                  onRentChange(
                    event.target.value
                      .replace(/\D/g, "")
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                  )
                }
                placeholder={formatMoney(data.affordability.breakdown.rent).replace("$", "")}
                value={rent}
                aria-invalid={invalidRent}
                aria-describedby="rent-hint"
              />
              {rent && (
                <button
                  aria-label="Clear monthly rent"
                  className="clear-rent"
                  onClick={() => {
                    onRentChange("");
                    rentInput.current?.focus();
                  }}
                  type="button"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
              <span className="rent-period">per month</span>
            </span>
          </label>
          <div className="roommate-control">
            <span id="roommate-label">Roommates</span>
            <div role="group" aria-labelledby="roommate-label">
              <button
                aria-label="Remove a roommate"
                disabled={roommates === 0}
                onClick={() => onRoommatesChange(Math.max(0, roommates - 1))}
                type="button"
              ><Minus size={16} aria-hidden="true" /></button>
              <output aria-live="polite">{roommates === 0 ? "Living alone" : roommates}</output>
              <button
                aria-label="Add a roommate"
                disabled={roommates === 3}
                onClick={() => onRoommatesChange(Math.min(3, roommates + 1))}
                type="button"
              ><Plus size={16} aria-hidden="true" /></button>
            </div>
          </div>
          <button
            className="action-button overview-analyze"
            disabled={isAnalyzing || invalidRent}
            type="submit"
          >
            {isAnalyzing ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        <p className={`rent-hint${invalidRent && rent ? " rent-hint-error" : ""}`} id="rent-hint">
          {invalidRent && rent
            ? "Enter a rent between $200 and $5,000."
            : "Enter an amount from $200 to $5,000, then choose Analyze."}
          {!isDefaultScenario && (
            <button className="reset-scenario" onClick={onReset} type="button">
              <RotateCcw size={14} aria-hidden="true" /> Reset to {formatMoney(data.affordability.breakdown.rent)}
            </button>
          )}
        </p>
        <div className="rent-examples" aria-label="Example monthly rents">
          {exampleRent && (
            <button
              onClick={() => onRentChange(String(exampleRent))}
              type="button"
            >
              {data.neighborhoods[0].name} typical: {formatMoney(exampleRent)}
            </button>
          )}
          {data.rentEstimates
            .filter((estimate) => estimate.monthlyRent !== exampleRent)
            .map((estimate) => (
              <button
                key={estimate.monthlyRent}
                onClick={() => onRentChange(String(estimate.monthlyRent))}
                type="button"
              >
                {formatMoney(estimate.monthlyRent)}
              </button>
            ))}
        </div>
        <button
          aria-expanded={showAdvanced}
          className="advanced-toggle"
          onClick={() => setShowAdvanced((open) => !open)}
          type="button"
        >
          {showAdvanced ? "Hide advanced details" : "Advanced details"}
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {showAdvanced && (
          <div className="advanced-fields overview-advanced-fields">
            <label>
              Utilities for apartment
              <span className="advanced-input">
                <span>$</span>
                <input
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => onUtilitiesChange(event.target.value)}
                  placeholder={String(data.affordability.breakdown.utilities)}
                  type="number"
                  value={utilities}
                />
                <small>per month</small>
              </span>
            </label>
            <label>
              Parking
              <span className="advanced-input">
                <span>$</span>
                <input
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => onParkingChange(event.target.value)}
                  placeholder={String(data.affordability.breakdown.parking)}
                  type="number"
                  value={parking}
                />
                <small>per month</small>
              </span>
            </label>
            <label>
              Lease starts
              <input
                onChange={(event) => onLeaseStartChange(event.target.value)}
                type="month"
                value={leaseStart}
              />
            </label>
          </div>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
      </form>
    </section>
  );
}

function RentAnalyzer({
  onResult,
  expanded = false,
  data,
  defaultRent,
  defaultCosts,
  estimates,
}: {
  onResult: (scenario: HousingScenario) => void;
  expanded?: boolean;
  data: DashboardData;
  defaultRent: number;
  defaultCosts: HousingCostBreakdown;
  estimates: HousingEstimate[];
}) {
  const [rent, setRent] = useState("");
  const [utilities, setUtilities] = useState("");
  const [parking, setParking] = useState("");
  const [roommates, setRoommates] = useState("0");
  const [leaseStart, setLeaseStart] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(expanded);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await estimateHousingScenario({
        monthlyRent: Number(rent || defaultRent),
        roommates: Number(roommates),
        utilities: utilities ? Number(utilities) : undefined,
        parking: parking ? Number(parking) : undefined,
        leaseStart: leaseStart || undefined,
      }, data);
      onResult(result);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn’t analyze this apartment. Try again.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <form className={`rent-analyzer${expanded ? " rent-analyzer-expanded" : ""}`} onSubmit={submit}>
      <div className="rent-analyzer-main">
        <label htmlFor="monthly-rent">Monthly rent</label>
        <div className="rent-control">
          <span aria-hidden="true">$</span>
          <input
            id="monthly-rent"
            inputMode="decimal"
            min="1"
            name="monthlyRent"
            onChange={(event) => setRent(event.target.value)}
            placeholder={formatMoney(defaultRent).replace("$", "")}
            required
            type="number"
            value={rent || String(defaultRent)}
          />
          <span className="rent-period">per month</span>
        </div>
        <button className="action-button" disabled={isAnalyzing} type="submit">
          {isAnalyzing ? "Checking…" : "Analyze"}
        </button>
      </div>
      <button
        aria-expanded={showAdvanced}
        className="advanced-toggle"
        onClick={() => setShowAdvanced((current) => !current)}
        type="button"
      >
        {showAdvanced ? "Hide details" : "Advanced details"}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {showAdvanced && (
        <div className="advanced-fields">
          <label>
            Utilities
            <span className="advanced-input">
              <span>$</span>
              <input
                inputMode="decimal"
                min="0"
                onChange={(event) => setUtilities(event.target.value)}
                placeholder={formatMoney(defaultCosts.utilities).replace("$", "")}
                type="number"
                value={utilities}
              />
              <small>/ month</small>
            </span>
          </label>
          <label>
            Parking
            <span className="advanced-input">
              <span>$</span>
              <input
                inputMode="decimal"
                min="0"
                onChange={(event) => setParking(event.target.value)}
                placeholder={formatMoney(defaultCosts.parking).replace("$", "")}
                type="number"
                value={parking}
              />
              <small>/ month</small>
            </span>
          </label>
          <label>
            Roommates
            <select
              onChange={(event) => setRoommates(event.target.value)}
              value={roommates}
            >
              <option value="0">Living alone</option>
              <option value="1">1 roommate</option>
              <option value="2">2 roommates</option>
            </select>
          </label>
          <label>
            Lease starts
            <input
              onChange={(event) => setLeaseStart(event.target.value)}
              type="month"
              value={leaseStart}
            />
          </label>
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
      <p className="analyzer-note">
        Rent suggestions are available for{" "}
        {estimates.map((estimate, index) => (
          <span key={estimate.monthlyRent}>
            {index > 0 && (index === estimates.length - 1 ? " and " : ", ")}
            {formatMoney(estimate.monthlyRent)}
          </span>
        ))}
        .{" "}
        {expanded
          ? "All entered costs are recalculated on the server."
          : "Results use the configured financial profile and campus assumptions."}
      </p>
    </form>
  );
}

function CashFlowSection({
  data,
  scenario,
  overview = false,
}: {
  data: DashboardData;
  scenario: HousingScenario;
  overview?: boolean;
}) {
  const lowest = scenario.cashFlow.reduce(
    (min, point) => Math.min(min, point.projectedBalance),
    Number.POSITIVE_INFINITY,
  );
  const belowBuffer = scenario.cashFlow
    .filter((point) => point.distanceFromBuffer < 0)
    .map((point) => fullMonthName[point.month] ?? point.month);
  const headline = belowBuffer.length
    ? `${belowBuffer.join(" and ")} dip below your safety cushion`
    : "Your balance stays above its safety cushion";

  return (
    <section className={`cashflow-section${overview ? " overview-cashflow" : ""}`} aria-labelledby="cashflow-title">
      <div className="section-heading">
        <div>
          <h2 id="cashflow-title">{overview ? "Your year" : headline}</h2>
          <p>
            {overview
              ? `${headline}. What happens to your balance month by month, across the modeled lease.`
              : "Lowest daily balance in each projected month."}
          </p>
        </div>
        <span className="chart-range">
          {overview ? `Safety cushion ${formatMoney(data.financials.safetyBuffer)}` : data.campus.term}
        </span>
      </div>
      <div className="cashflow-panel">
        <CashFlowChart
          data={scenario.cashFlow}
          safetyBuffer={data.financials.safetyBuffer}
          overview={overview}
        />
        <p className="chart-summary" id="cashflow-summary">
          The balance bottoms out at {formatMoney(lowest)}.{" "}
          {belowBuffer.length
            ? `${belowBuffer.join(" and ")} fall below your ${formatMoney(data.financials.safetyBuffer)} safety cushion.`
            : `Your ${formatMoney(data.financials.safetyBuffer)} safety cushion stays intact.`}
        </p>
      </div>
    </section>
  );
}

function ScenarioComparison({
  data,
  selectedId,
  onSelect,
  overview = false,
}: {
  data: DashboardData;
  selectedId: string;
  onSelect: (scenario: HousingScenario) => void;
  overview?: boolean;
}) {
  const highestCost = data.scenarios.reduce(
    (highest, scenario) => Math.max(highest, scenario.monthlyCost),
    0,
  );

  return (
    <section
      className={`scenario-section${overview ? " overview-scenario-comparison" : ""}`}
      id={overview ? "options" : undefined}
      aria-labelledby="scenario-title"
    >
      <div className="section-heading">
        <div>
          <h2 id="scenario-title">{overview ? "Other ways to live" : "Compare the monthly trade-offs"}</h2>
          <p>Choose an option to update your outlook.</p>
        </div>
      </div>
      <div className="scenario-table" role="group" aria-label="Housing options">
        <div className="scenario-table-head" aria-hidden="true">
          <span>Option</span>
          <span>True monthly cost</span>
          <span>Left over per month</span>
          <span>Status</span>
        </div>
        {data.scenarios.map((scenario) => (
          <button
            aria-pressed={selectedId === scenario.id}
            className={`scenario-row${selectedId === scenario.id ? " scenario-row-selected" : ""}`}
            key={scenario.id}
            onClick={() => onSelect(scenario)}
            type="button"
          >
            <span className="scenario-option">
              <span className="scenario-option-title">{scenario.title}</span>
              <span
                aria-hidden="true"
                className="scenario-bar"
              >
                <span
                  className={`scenario-bar-fill scenario-bar-${scenario.status}`}
                  style={{
                    width: `${(scenario.monthlyCost / highestCost) * 100}%`,
                  }}
                />
              </span>
            </span>
            <strong>{formatMoney(scenario.monthlyCost)} <small>/ mo</small></strong>
            <strong>{formatMoney(scenario.monthlyRemaining)} <small>/ mo</small></strong>
            <StatusText status={scenario.status}>
              {scenario.status === "comfortable"
                ? "Comfortable"
                : scenario.status === "tight"
                  ? "Tight"
                  : "Higher risk"}
            </StatusText>
          </button>
        ))}
      </div>
      <p className="scenario-delta">
        {overview ? (
          <>
            A roommate could add{" "}
            <strong>{formatMoney(data.scenarios.find((scenario) => scenario.id === "roommate")?.savingsVsSolo ?? 0)} a month compared with living alone.</strong>
          </>
        ) : (
          <>
            <strong>
              +{formatMoney(data.scenarios.find((scenario) => scenario.id === "roommate")?.savingsVsSolo ?? 0)} a month vs living alone
            </strong>{" "}
            with a roommate.
          </>
        )}
      </p>
    </section>
  );
}

function NeighborhoodTable({
  data,
}: {
  data: DashboardData;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedNeighborhoods = data.neighborhoods.filter((neighborhood) =>
    selectedIds.includes(neighborhood.id),
  );

  function toggleSelection(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((currentId) => currentId !== id);
      }
      return current.length < 3 ? [...current, id] : current;
    });
  }

  if (data.neighborhoods.length === 0) {
    return (
      <div className="empty-state">
        <p>Neighborhood details aren’t available for this campus yet.</p>
        <Link className="inline-link" href="/housing">Try the housing estimator</Link>
      </div>
    );
  }

  return (
    <section className="neighborhood-table-section">
      <div className="section-heading">
        <div>
          <h2>Compare neighborhoods near {data.campus.city}</h2>
          <p>Select up to three areas to keep their costs in view.</p>
        </div>
      </div>
      <div className="neighborhood-table-wrap">
        <table className="neighborhood-table">
          <thead>
            <tr>
              <th scope="col">Area</th>
              <th scope="col">Typical rent</th>
              <th scope="col">Commute</th>
              <th scope="col">Monthly total</th>
              <th scope="col">Student fit</th>
              <th scope="col">Outlook</th>
              <th scope="col"><span className="sr-only">Compare</span></th>
            </tr>
          </thead>
          <tbody>
            {data.neighborhoods.map((neighborhood) => (
              <tr key={neighborhood.id}>
                <th scope="row">{neighborhood.name}</th>
                <td>{formatMoney(neighborhood.typicalRent)}</td>
                <td>{neighborhood.commute}</td>
                <td>{formatMoney(neighborhood.estimatedMonthlyCost)}</td>
                <td>{neighborhood.studentFit}</td>
                <td>
                  <StatusText status={neighborhood.status}>
                    {neighborhood.status === "comfortable"
                      ? "Within range"
                      : neighborhood.status === "tight"
                        ? "Tight"
                        : "Higher risk"}
                  </StatusText>
                </td>
                <td>
                  <label className="compare-check">
                    <input
                      checked={selectedIds.includes(neighborhood.id)}
                      disabled={!selectedIds.includes(neighborhood.id) && selectedIds.length >= 3}
                      onChange={() => toggleSelection(neighborhood.id)}
                      type="checkbox"
                    />
                    <span className="sr-only">Compare {neighborhood.name}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedNeighborhoods.length > 0 && (
        <div className="selected-neighborhoods" aria-live="polite">
          <span>Comparing</span>
          {selectedNeighborhoods.map((neighborhood) => (
            <strong key={neighborhood.id}>
              {neighborhood.name} · {formatMoney(neighborhood.estimatedMonthlyCost)}/mo
            </strong>
          ))}
        </div>
      )}
    </section>
  );
}

function AskMovinEntry({ result }: { result: AffordabilityResult }) {
  const [prompt, setPrompt] = useState("");
  const router = useRouter();

  function openAskPage(question: string) {
    router.push(`/ask?prompt=${encodeURIComponent(question)}`);
  }

  return (
    <section className="ask-entry" aria-labelledby="ask-entry-title">
      <div className="section-heading">
        <h2 id="ask-entry-title">Ask Movin</h2>
        <p>Get help with rent, roommates, or a tight month.</p>
      </div>
      <form
        className="overview-ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (prompt.trim()) openAskPage(prompt.trim());
        }}
      >
        <label className="sr-only" htmlFor="overview-ask-input">Your question for Movin</label>
        <input
          id="overview-ask-input"
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask about rent, roommates, or a tight month"
          value={prompt}
        />
        <button className="action-button" disabled={!prompt.trim()} type="submit">
          Ask <ArrowRight size={16} aria-hidden="true" />
        </button>
      </form>
      <div className="prompt-links" aria-label="Suggested questions">
        {mockPrompts.slice(0, 3).map((prompt) => (
          <button
            onClick={() => openAskPage(prompt)}
            key={prompt}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>
      <span className="sr-only">
        Current housing cost {formatMoney(result.trueMonthlyCost)} per month.
      </span>
    </section>
  );
}

function ChatExperience({
  selectedQuery,
  data,
  initialPrompt,
  result,
  onSelectScenario,
}: {
  selectedQuery: import("@/lib/types").HousingQuery;
  data: DashboardData;
  initialPrompt?: string;
  result: AffordabilityResult;
  onSelectScenario: (scenario: HousingScenario) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialPrompt ?? "");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sequence, setSequence] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, isSending]);

  async function send(content: string) {
    const prompt = content.trim();
    if (!prompt || isSending) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: `user-${sequence}`,
        role: "user",
        content: prompt,
        createdAt: "Now",
      },
    ]);
    setSequence((current) => current + 1);
    setDraft("");
    setIsSending(true);
    setError(null);

    try {
      const reply = await sendAssistantMessage(prompt, data, selectedQuery, messages);
      setMessages((current) => [...current, reply]);
      if (reply.scenario) onSelectScenario(reply.scenario);
      if (reply.scenarioId) {
        const scenario = data.scenarios.find(
          (item) => item.id === reply.scenarioId,
        );
        if (scenario) {
          onSelectScenario(scenario);
        }
      }
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Movin couldn’t answer just now. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  }

  return (
    <div className="chat-layout">
      <section className="conversation" aria-label="Ask Movin conversation">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <p className="chat-eyebrow">YOUR HOUSING COPILOT</p>
            <h2>What can we figure out together?</h2>
            <p>Ask about rent, roommates, or a tight month. Start with a question or choose a prompt.</p>
            <ul className="prompt-list">
              {mockPrompts.map((prompt) => (
                <li key={prompt}>
                  <button onClick={() => void send(prompt)} type="button">
                    <span>{prompt}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="chat-demo-note">{data.assistantMode === 'asi' ? 'Chat with Movin · powered by ASI, with financial calculations from your selected plan.' : 'Offline finance assistant · ASI is not configured. Ask about rent, roommates, spending, or your forecast.'}</p>
          </div>
        ) : (
          <div className="chat-messages" aria-live="polite" aria-busy={isSending}>
            {messages.map((message) => (
              <article
                className={`chat-message chat-${message.role}`}
                key={message.id}
              >
                <p className="chat-author">{message.role === "assistant" ? "Movin" : "You"}</p>
                <p>{message.content}</p>
                {message.role === "assistant" && message.scenarioId && (
                  <div className="chat-result-block">
                    <StatusText status={result.status}>
                      {result.status === "comfortable"
                        ? "Comfortable"
                        : result.status === "tight"
                          ? `Tight in ${result.riskMonths.join(" and ")}`
                          : "Higher risk"}
                    </StatusText>
                    <div>
                      <span>True monthly cost</span>
                      <strong>{formatMoney(result.trueMonthlyCost)}</strong>
                    </div>
                    <div>
                      <span>Left after housing</span>
                      <strong>{formatMoney(result.monthlyRemaining)}</strong>
                    </div>
                    {message.scenarioId !== "roommate" && (
                      <button
                        className="inline-link"
                        onClick={() => {
                          const roommate = data.scenarios.find(
                            (scenario) => scenario.id === "roommate",
                          );
                          if (roommate) onSelectScenario(roommate);
                        }}
                        type="button"
                      >
                        Compare roommate option <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
            {isSending && (
              <p className="chat-loading" role="status">
                Movin is checking your housing plan…
              </p>
            )}
            <div ref={endRef} />
          </div>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
        {messages.length > 0 && (
          <div className="chat-prompts" aria-label="Try another question">
            {mockPrompts.slice(1).map((prompt) => (
              <button
                disabled={isSending}
                key={prompt}
                onClick={() => void send(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        <form
          className="chat-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <label className="sr-only" htmlFor="chat-input">
            Ask Movin a question
          </label>
          <textarea
            id="chat-input"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask about your housing plan…"
            rows={1}
            value={draft}
          />
          <button
            aria-label="Send message"
            className="send-button"
            disabled={!draft.trim() || isSending}
            type="submit"
          >
            <Send size={16} aria-hidden="true" />
          </button>
        </form>
        <p className="composer-hint">Enter to send · Shift + Enter for a new line</p>
      </section>
      <aside className="scenario-context" aria-label="Current housing scenario">
        <h2>Current scenario</h2>
        <div>
          <span>Apartment rent</span>
          <strong>{formatMoney(result.breakdown.rent)} / mo</strong>
        </div>
        <div>
          <span>True monthly cost</span>
          <strong>{formatMoney(result.trueMonthlyCost)} / mo</strong>
        </div>
        <div>
          <span>Outlook</span>
          <StatusText status={result.status}>
            {result.status === "comfortable"
              ? "Comfortable"
              : result.status === "tight"
                ? "Tight"
                : "Higher risk"}
          </StatusText>
        </div>
        <div>
          <span>Campus</span>
          <strong>{data.campus.name}</strong>
        </div>
      </aside>
    </div>
  );
}

export function MovinDashboard({
  view = "overview",
  initialPrompt,
}: {
  view?: DashboardView;
  initialPrompt?: string;
}) {
  const [data, setData] = useState<CampusDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [campusId, setCampusId] = useState<CampusId>(() => {
    if (typeof window === "undefined") return "michigan";
    const urlCampus = new URLSearchParams(window.location.search).get("campus");
    if (isCampusId(urlCampus)) return urlCampus;
    let storedCampus: string | null = null;
    try {
      storedCampus = window.localStorage.getItem("movin-campus");
    } catch (reason: unknown) {
      console.warn("Could not read the saved campus preference.", reason);
    }
    return isCampusId(storedCampus) ? storedCampus : "michigan";
  });
  const [campusNotice, setCampusNotice] = useState<string | null>(null);
  const previousCampusId = useRef<CampusId | null>(null);
  const [selectedId, setSelectedId] = useState("solo");
  const [analyzedResult, setAnalyzedResult] = useState<AffordabilityResult | null>(null);
  const [analyzedScenario, setAnalyzedScenario] = useState<HousingScenario | null>(null);
  const [overviewRent, setOverviewRent] = useState("");
  const [overviewRoommates, setOverviewRoommates] = useState(0);
  const [overviewUtilities, setOverviewUtilities] = useState("");
  const [overviewParking, setOverviewParking] = useState("");
  const [overviewLeaseStart, setOverviewLeaseStart] = useState("");
  const [isAnalyzingOverview, setIsAnalyzingOverview] = useState(false);
  const [overviewScenarioError, setOverviewScenarioError] = useState<string | null>(null);
  const [leaseResults, setLeaseResults] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => {
      if (active) { setError(null); setData(null); setAnalyzedResult(null); setAnalyzedScenario(null); }
      return getDashboardData(campusId);
    })
      .then((response) => {
        if (active) setData(response);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "We couldn’t load your financial summary.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [attempt, campusId]);

  useEffect(() => {
    try {
      window.localStorage.setItem("movin-campus", campusId);
    } catch (reason: unknown) {
      console.warn("Could not save the campus preference.", reason);
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("campus") !== campusId) {
      params.set("campus", campusId);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      );
    }
  }, [campusId]);

  useEffect(() => {
    function restoreCampusFromUrl() {
      const urlCampus = new URLSearchParams(window.location.search).get("campus");
      if (isCampusId(urlCampus)) {
        setCampusId(urlCampus);
        try {
          window.localStorage.setItem("movin-campus", urlCampus);
        } catch (reason: unknown) {
          console.warn("Could not save the campus preference.", reason);
        }
      }
    }
    window.addEventListener("popstate", restoreCampusFromUrl);
    return () => window.removeEventListener("popstate", restoreCampusFromUrl);
  }, []);

  useEffect(() => {
    if (!campusNotice) return;
    const timeout = window.setTimeout(() => setCampusNotice(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [campusNotice]);

  useEffect(() => {
    if (!data) return;
    const dashboardData = data;

    async function restoreScenarioFromUrl() {
      const params = new URLSearchParams(window.location.search);
      const saved = window.sessionStorage.getItem("movin-plan");
      let prior: { campus?: string; query?: import("@/lib/types").HousingQuery } = {};
      try { prior = saved ? JSON.parse(saved) : {}; } catch {}
      if (!params.has("rent") && prior.campus === dashboardData.campus.id && prior.query) {
        for (const [key, value] of Object.entries(prior.query)) if (value !== undefined) params.set(key === "monthlyRent" ? "rent" : key, String(value));
      }
      const rentValue = params.get("rent");
      const roommateValue = Number(params.get("roommates") ?? "0");
      const utilitiesValue = params.get("utilities") ?? "";
      const parkingValue = params.get("parking") ?? "";
      const leaseStartValue = params.get("leaseStart") ?? "";
      if (!rentValue) {
        setOverviewRent(formatRentInput(dashboardData.affordability.breakdown.rent));
        setOverviewRoommates(0);
        setOverviewUtilities("");
        setOverviewParking("");
        setOverviewLeaseStart("");
        setAnalyzedScenario(null);
        setSelectedId("solo");
        return;
      }

      const monthlyRent = Number(rentValue);
      setOverviewRent(formatRentInput(monthlyRent));
      setOverviewRoommates(roommateValue);
      setOverviewUtilities(utilitiesValue);
      setOverviewParking(parkingValue);
      setOverviewLeaseStart(leaseStartValue);
      setIsAnalyzingOverview(true);
      setOverviewScenarioError(null);
      try {
        const scenario = await estimateHousingScenario({
          monthlyRent,
          roommates: roommateValue,
          utilities: utilitiesValue ? Number(utilitiesValue) : undefined,
          parking: parkingValue ? Number(parkingValue) : undefined,
          leaseStart: leaseStartValue || undefined,
        }, dashboardData);
        setAnalyzedScenario(scenario);
        setSelectedId(scenario.id);
      } catch (reason: unknown) {
        setOverviewScenarioError(
          reason instanceof Error ? reason.message : "We couldn’t restore this housing estimate.",
        );
      } finally {
        setIsAnalyzingOverview(false);
      }
    }

    void restoreScenarioFromUrl();
    window.addEventListener("popstate", restoreScenarioFromUrl);
    return () => window.removeEventListener("popstate", restoreScenarioFromUrl);
  }, [data]);

  if (!data) {
    return (
      <LoadState
        error={error}
        retry={() => {
          setError(null);
          setAttempt((current) => current + 1);
        }}
      />
    );
  }

  const selectedScenario =
    analyzedScenario ??
    data.scenarios.find((scenario) => scenario.id === selectedId) ??
    data.scenarios[0];
  const currentResult = analyzedResult ?? selectedScenario.result;
  const dashboardData = data;

  function changeCampus(nextCampusId: CampusId, showUndo = true) {
    if (nextCampusId === campusId) return;
    if (showUndo && campusId) {
      previousCampusId.current = campusId;
      const nextCampus = campusProfiles.find(({ id }) => id === nextCampusId);
      setCampusNotice(`Switched to ${nextCampus?.shortName ?? nextCampusId}.`);
    } else {
      previousCampusId.current = null;
      setCampusNotice(null);
    }
    setCampusId(nextCampusId);
    setError(null);
    try {
      window.localStorage.setItem("movin-campus", nextCampusId);
    } catch (reason: unknown) {
      console.warn("Could not save the campus preference.", reason);
    }
    const params = new URLSearchParams(window.location.search);
    params.set("campus", nextCampusId);
    window.history.pushState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function undoCampusChange() {
    const priorCampus = previousCampusId.current;
    if (priorCampus) changeCampus(priorCampus, false);
  }

  function selectScenario(scenario: HousingScenario) {
    setSelectedId(scenario.id);
    setAnalyzedScenario({ ...scenario, comparisons: selectedScenario.comparisons });
    setAnalyzedResult(null);
    setOverviewRent(formatRentInput(scenario.monthlyRent));
    setOverviewRoommates(scenario.roommates);
    setOverviewUtilities("");
    setOverviewParking("");
    setOverviewLeaseStart("");
    setOverviewScenarioError(null);
    {
      const params = new URLSearchParams({
        campus: dashboardData.campus.id,
        rent: String(scenario.monthlyRent),
        roommates: String(scenario.roommates),
      });
      window.history.pushState(null, "", `?${params.toString()}`);
      window.sessionStorage.setItem("movin-plan", JSON.stringify({ campus: dashboardData.campus.id, query: scenario.query ?? { monthlyRent: scenario.monthlyRent, roommates: scenario.roommates } }));
    }
  }

  async function analyzeOverviewScenario(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const monthlyRent = Number(overviewRent.replaceAll(",", ""));
    if (!Number.isInteger(monthlyRent) || monthlyRent < 200 || monthlyRent > 5000) {
      setOverviewScenarioError("Enter a rent between $200 and $5,000.");
      return;
    }

    setIsAnalyzingOverview(true);
    setOverviewScenarioError(null);
    try {
      const scenario = await estimateHousingScenario({
        monthlyRent,
        roommates: overviewRoommates,
        utilities: overviewUtilities ? Number(overviewUtilities) : undefined,
        parking: overviewParking ? Number(overviewParking) : undefined,
        leaseStart: overviewLeaseStart || undefined,
      }, dashboardData);
      setAnalyzedScenario(scenario);
      setAnalyzedResult(null);
      setSelectedId(scenario.id);
      setOverviewRent(formatRentInput(monthlyRent));
      const params = new URLSearchParams({
        campus: dashboardData.campus.id,
        rent: String(monthlyRent),
        roommates: String(overviewRoommates),
        ...(overviewUtilities ? { utilities: overviewUtilities } : {}),
        ...(overviewParking ? { parking: overviewParking } : {}),
        ...(overviewLeaseStart ? { leaseStart: overviewLeaseStart } : {}),
      });
      window.history.pushState(null, "", `?${params.toString()}`);
      window.sessionStorage.setItem("movin-plan", JSON.stringify({ campus: dashboardData.campus.id, query: scenario.query ?? { monthlyRent: scenario.monthlyRent, roommates: scenario.roommates } }));
    } catch (reason: unknown) {
      setOverviewScenarioError(
        reason instanceof Error ? reason.message : "We couldn’t analyze this apartment. Try again.",
      );
    } finally {
      setIsAnalyzingOverview(false);
    }
  }

  function resetOverviewScenario() {
    setOverviewRent(formatRentInput(dashboardData.affordability.breakdown.rent));
    setOverviewRoommates(0);
    setOverviewUtilities("");
    setOverviewParking("");
    setOverviewLeaseStart("");
    setAnalyzedScenario(null);
    setAnalyzedResult(null);
    window.sessionStorage.removeItem("movin-plan");
    setSelectedId("solo");
    setOverviewScenarioError(null);
    window.history.pushState(
      null,
      "",
      `${window.location.pathname}?campus=${dashboardData.campus.id}`,
    );
  }

  const pageTitle = {
    overview: "Good afternoon, Alex",
    housing: "Make a housing plan that fits.",
    ask: "Ask about your housing plan.",
    neighborhoods: "Find your place near campus.",
  }[view];

  return (
    <AppShell
      data={data}
      view={view}
      onCampusChange={changeCampus}
      campusNotice={campusNotice}
      onUndoCampusChange={undoCampusChange}
      onDismissCampusNotice={() => setCampusNotice(null)}
    >
      <details className="data-assumptions"><summary>{data.source === "nessie-sandbox" ? "Nessie sandbox" : "Alex demo"} · Data sources and assumptions</summary><ul>{data.notices?.map((notice, index) => <li key={index}>{notice}</li>)}</ul></details>
      {view === "overview" && (
        <>
          <header className="overview-header" id="overview">
            <h1>{pageTitle}</h1>
            <p>
              {data.campus.city}, {data.campus.state} · {data.campus.termLabel}. Here’s what a{" "}
              {formatMoney(selectedScenario.monthlyRent)}{" "}
              apartment would really cost you.
            </p>
            <p className="campus-tip">{data.campus.tip}</p>
          </header>
          <OverviewScenarioForm
            data={data}
            rent={overviewRent}
            roommates={overviewRoommates}
            utilities={overviewUtilities}
            parking={overviewParking}
            leaseStart={overviewLeaseStart}
            isAnalyzing={isAnalyzingOverview}
            error={overviewScenarioError}
            onRentChange={setOverviewRent}
            onRoommatesChange={setOverviewRoommates}
            onUtilitiesChange={setOverviewUtilities}
            onParkingChange={setOverviewParking}
            onLeaseStartChange={setOverviewLeaseStart}
            onSubmit={analyzeOverviewScenario}
            onReset={resetOverviewScenario}
          />
          <p className="showing-scenario" aria-live="polite">
            Showing: {formatMoney(selectedScenario.monthlyRent)} rent,{" "}
            {selectedScenario.roommates === 0
              ? "living alone"
              : `${selectedScenario.roommates} roommate${selectedScenario.roommates === 1 ? "" : "s"}`}
          </p>
          <HeroAnswer data={data} result={currentResult} overview busy={isAnalyzingOverview} />
          <p className="sample-caption">Move-in cash required: {formatMoney(currentResult.upfrontCashRequired ?? 0)} · includes first month’s rent, deposit, application fee and moving costs.</p>
          <FinanceStrip data={data} />
          <CashFlowSection data={data} scenario={selectedScenario} overview />
          <ScenarioComparison
            data={{ ...data, scenarios: selectedScenario.comparisons ?? data.scenarios }}
            onSelect={selectScenario}
            selectedId={selectedId}
            overview
          />
          <ListingCards campus={data.campus} />
          <AskMovinEntry result={currentResult} />
          <footer className="page-footer">
            <span>Movin · {data.campus.name}</span>
            <span>Illustrative projections, not financial advice.</span>
          </footer>
        </>
      )}
      {view === "housing" && (
        <>
          <header className="route-header">
            <h1>{pageTitle}</h1>
            <p>See how rent, utilities, and getting to campus change your monthly picture.</p>
          </header>
          <HeroAnswer data={data} result={currentResult} />
          <p className="sample-caption">Move-in cash required: {formatMoney(currentResult.upfrontCashRequired ?? 0)} · includes first month’s rent, deposit, application fee and moving costs.</p>
          <div className="housing-planner-grid">
            <section className="analyzer-section" aria-labelledby="housing-analyzer-title">
              <div className="section-heading">
                <h2 id="housing-analyzer-title">Apartment details</h2>
                <p>Start with rent. Add the costs you know.</p>
              </div>
              <RentAnalyzer
                expanded
                data={data}
                defaultRent={data.affordability.breakdown.rent}
                defaultCosts={data.affordability.breakdown}
                estimates={data.rentEstimates}
                onResult={(scenario) => {
                  setAnalyzedScenario(scenario);
                  setAnalyzedResult(null);
                  window.sessionStorage.setItem("movin-plan", JSON.stringify({ campus: data.campus.id, query: scenario.query }));
                  setLeaseResults((current) => current + 1);
                }}
              />
              {leaseResults > 0 && (
                <p className="success-note" role="status">
                  Your housing estimate has been refreshed.
                </p>
              )}
            </section>
            <aside className="housing-context">
              <h2>What’s included</h2>
              <p>True monthly housing cost</p>
              <strong>{formatMoney(currentResult.trueMonthlyCost)}</strong>
              <div className="ledger-rows">
                <div className="ledger-row"><span>Utilities</span><span>{formatMoney(currentResult.breakdown.utilities)}</span></div>
                <div className="ledger-row"><span>Internet</span><span>{formatMoney(currentResult.breakdown.internet)}</span></div>
                <div className="ledger-row"><span>Insurance</span><span>{formatMoney(currentResult.breakdown.insurance)}</span></div>
                <div className="ledger-row"><span>Transportation</span><span>{formatMoney(currentResult.breakdown.transportation)}</span></div>
              </div>
              <p className="housing-note">Calculated by the finance engine. Check the data sources and assumptions above before comparing a lease.</p>
            </aside>
          </div>
          <ScenarioComparison data={{ ...data, scenarios: selectedScenario.comparisons ?? data.scenarios }} onSelect={selectScenario} selectedId={selectedId} />
          <ListingCards campus={data.campus} />
          <CashFlowSection data={data} scenario={selectedScenario} />
        </>
      )}
      {view === "ask" && (
        <>
          <header className="route-header">
            <h1>{pageTitle}</h1>
            <p>Questions about rent, roommates, or a tight month.</p>
          </header>
          <ChatExperience
            selectedQuery={selectedScenario.query ?? { monthlyRent: selectedScenario.monthlyRent, roommates: selectedScenario.roommates }}
            data={data}
            initialPrompt={initialPrompt}
            onSelectScenario={selectScenario}
            result={currentResult}
          />
        </>
      )}
      {view === "neighborhoods" && (
        <>
          <header className="route-header">
            <h1>{pageTitle}</h1>
            <p>
              Compare rent, commute, and monthly cost near {data.campus.name}.
              {" "}Local transit: {data.campus.transit}.
            </p>
          </header>
          <NeighborhoodTable data={data} />
          <ListingCards campus={data.campus} />
          <div className="neighborhood-next-step">
            <h2>Found an area to explore?</h2>
            <p>Check how an apartment there fits your monthly housing plan.</p>
            <Link className="action-button" href="/housing">Check the full cost</Link>
          </div>
        </>
      )}
    </AppShell>
  );
}
