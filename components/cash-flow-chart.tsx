"use client";

import { Component, Fragment, useId, type ReactNode } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashFlowPoint } from "@/lib/types";

interface CashFlowTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    dataKey?: string;
    payload?: CashFlowPoint;
    value?: number | string;
  }>;
}

interface CashFlowChartProps {
  data: CashFlowPoint[];
  safetyBuffer: number;
  overview?: boolean;
}

interface ChartErrorBoundaryProps {
  children: ReactNode;
  data: CashFlowPoint[];
  safetyBuffer: number;
}

interface ChartErrorBoundaryState {
  hasError: boolean;
  retryKey: number;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const monthNames: Record<string, string> = {
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

function CashFlowTooltip({
  active,
  label,
  payload,
}: CashFlowTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }
  const point = payload.find(
    (item) => item.dataKey === "projectedBalance",
  )?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>Projected balance {currency.format(point.projectedBalance)}</span>
      <span>
        From safety cushion{" "}
        {point.distanceFromBuffer < 0
          ? `${currency.format(Math.abs(point.distanceFromBuffer))} below`
          : `${currency.format(point.distanceFromBuffer)} above`}
      </span>
      {point.event && <small>{point.event}</small>}
    </div>
  );
}

function CashFlowDataTable({
  data,
  safetyBuffer,
  className,
}: {
  data: CashFlowPoint[];
  safetyBuffer: number;
  className?: string;
}) {
  return (
    <table className={className}>
      <caption>
        Projected balance by month compared with the safety cushion
      </caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">Projected balance</th>
          <th scope="col">Compared with cushion</th>
          <th scope="col">Note</th>
        </tr>
      </thead>
      <tbody>
        {data.map((point) => (
          <tr key={point.month}>
            <th scope="row">{monthNames[point.month] ?? point.month}</th>
            <td>{currency.format(point.projectedBalance)}</td>
            <td>
              {point.distanceFromBuffer < 0 ? "Below" : "At or above"}{" "}
              {currency.format(safetyBuffer)}
            </td>
            <td>{point.event ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  state: ChartErrorBoundaryState = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<ChartErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Cash-flow chart failed to render.", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="chart-error" role="alert">
          <p>The chart could not be displayed. Your monthly data is still available below.</p>
          <button
            className="button-secondary chart-retry"
            onClick={() =>
              this.setState((state) => ({
                hasError: false,
                retryKey: state.retryKey + 1,
              }))
            }
            type="button"
          >
            Try again
          </button>
          <CashFlowDataTable
            className="chart-error-table"
            data={this.props.data}
            safetyBuffer={this.props.safetyBuffer}
          />
        </div>
      );
    }

    return (
      <Fragment key={this.state.retryKey}>
        {this.props.children}
      </Fragment>
    );
  }
}

export function CashFlowChart({
  data,
  safetyBuffer,
  overview = false,
}: CashFlowChartProps) {
  const chartId = useId().replaceAll(":", "");
  const areaFillId = `balance-area-${chartId}`;
  const riskPatternId = `risk-hatch-${chartId}`;
  const chartData = data.map((point) => ({
    ...point,
    month: overview ? monthNames[point.month] ?? point.month : point.month,
    aboveBuffer:
      point.distanceFromBuffer >= 0 ? point.projectedBalance : null,
    belowBuffer:
      point.distanceFromBuffer < 0 ? point.projectedBalance : null,
  }));

  return (
    <div className="chart-wrap" aria-describedby="cashflow-summary">
      <div className="chart-plot">
        <ChartErrorBoundary data={data} safetyBuffer={safetyBuffer}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 37, right: 22, bottom: 2, left: 0 }}
            >
              <defs>
                <linearGradient id={areaFillId} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary-light)" stopOpacity={overview ? 0.2 : 0.12} />
                  <stop offset="100%" stopColor="var(--primary-light)" stopOpacity={0} />
                </linearGradient>
                <pattern
                  height="6"
                  id={riskPatternId}
                  patternTransform="rotate(45)"
                  patternUnits="userSpaceOnUse"
                  width="6"
                >
                  <rect fill="var(--warning-wash)" height="6" width="6" />
                  <line
                    stroke="var(--warning)"
                    strokeOpacity=".35"
                    strokeWidth="1"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="6"
                  />
                </pattern>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="var(--border)"
                strokeDasharray="2 5"
              />
              <XAxis
                axisLine={false}
                dataKey="month"
                interval="preserveStartEnd"
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: overview ? 13 : 11 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                domain={["dataMin - 500", "dataMax + 500"]}
                tickFormatter={(value: number) => currency.format(value)}
                tickLine={false}
                tick={{ fill: "var(--muted)", fontSize: overview ? 13 : 10 }}
                width={overview ? 74 : 60}
              />
              <Tooltip content={<CashFlowTooltip />} />
              <ReferenceLine
                y={safetyBuffer}
                stroke={overview ? "var(--primary-light)" : "var(--warning)"}
                strokeDasharray="5 5"
                label={{
                  value: `Safety cushion · ${currency.format(safetyBuffer)}`,
                  position: "insideTopRight",
                  fill: overview ? "var(--primary-light)" : "var(--warning)",
                  fontSize: overview ? 13 : 10,
                  fontFamily: "var(--font-ui)",
                }}
              />
              {chartData
                .filter((point) => point.event)
                .map((point) => (
                  <ReferenceDot
                    key={point.month}
                    x={point.month}
                    y={point.projectedBalance}
                    r={3}
                    fill={
                      point.eventKind === "positive"
                        ? "var(--success)"
                        : "var(--warning)"
                    }
                    stroke="var(--surface)"
                    strokeWidth={2}
                    label={{
                      value: point.event,
                      position: point.eventKind === "warning" ? "top" : "bottom",
                      fill: "var(--muted-strong)",
                      fontSize: overview ? 11 : 9,
                      fontFamily: "var(--font-ui)",
                    }}
                  />
                ))}
              <Area
                type="monotone"
                dataKey="projectedBalance"
                fill={`url(#${areaFillId})`}
                fillOpacity={1}
                stroke="none"
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="projectedBalance"
                name="Projected balance"
                stroke={overview ? "var(--primary-light)" : "var(--primary)"}
                strokeWidth={2}
                dot={
                  overview
                    ? { r: 3, fill: "var(--primary-light)", stroke: "var(--surface)", strokeWidth: 2 }
                    : false
                }
                activeDot={{ r: 4, fill: "var(--primary)", stroke: "var(--surface)", strokeWidth: 2 }}
              />
              <Line
                type="monotone"
                dataKey="belowBuffer"
                name="Below safety cushion"
                stroke="var(--warning)"
                strokeWidth={2.5}
                strokeDasharray="5 4"
                dot={{ r: 4, fill: `url(#${riskPatternId})`, stroke: "var(--warning)", strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartErrorBoundary>
      </div>
      <div className="chart-risk-note">
        <span className="risk-pattern" aria-hidden="true" />
        {overview
          ? "Dashed points and labels mark months below your safety cushion"
          : "Hatched points mark months below the safety cushion"}
      </div>
      {overview && (
        <CashFlowDataTable
          className="sr-only"
          data={data}
          safetyBuffer={safetyBuffer}
        />
      )}
    </div>
  );
}
