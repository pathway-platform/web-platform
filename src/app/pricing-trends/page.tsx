"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import EmptyState from "@/components/EmptyState";

type Ingredient = {
  id: number;
  canonical_name: string;
  category: string;
  unit: string;
};

type SparklinePoint = { x: string; y: number };
type ParsedSparkline = { points: SparklinePoint[]; hasDates: boolean };

type PricingTrend = {
  id: number;
  report_id: string;
  commodity_filter: string;
  ingredients_covered: string;
  status: "priced" | "no_data" | "error" | string;
  price_value: number | null;
  price_unit: string | null;
  price_as_of: string | null;
  trend_label:
    | "rising"
    | "falling"
    | "stable"
    | "insufficient_data"
    | string
    | null;
  change_30d_pct: number | null;
  change_90d_pct: number | null;
  sparkline: unknown;
  data_points: number | null;
  source: string;
  error: string | null;
  created_at: string;
  ingredients: Ingredient[];
};

export default function PricingTrendsPage() {
  const [trends, setTrends] = useState<PricingTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing-trends")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setTrends(data.trends);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const total = trends.length;
    const rising = trends.filter((t) => t.trend_label === "rising").length;
    const falling = trends.filter((t) => t.trend_label === "falling").length;
    const stable = trends.filter((t) => t.trend_label === "stable").length;
    return { total, rising, falling, stable };
  }, [trends]);

  const filtered = useMemo(() => {
    if (!query) return trends;
    const q = query.toLowerCase();
    return trends.filter(
      (t) =>
        t.commodity_filter.toLowerCase().includes(q) ||
        t.ingredients.some((i) => i.canonical_name.toLowerCase().includes(q)),
    );
  }, [trends, query]);

  if (!loading && !error && trends.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Pricing Trends
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Commodity-level price tracking from USDA AMS, joined to your
          ingredients.
        </p>

        {!loading && !error && trends.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-3">
            <SummaryStat label="Tracked" value={summary.total} tone="neutral" />
            <SummaryStat
              label="Rising"
              value={summary.rising}
              tone="rising"
            />
            <SummaryStat
              label="Falling"
              value={summary.falling}
              tone="falling"
            />
            <SummaryStat label="Stable" value={summary.stable} tone="stable" />
          </div>
        )}
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        {loading ? (
          <p className="text-sm text-zinc-500">Loading trends…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Error: {error}</p>
        ) : (
          <>
            <Disclaimer />
            <div className="mb-5">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commodity or ingredient…"
                className="h-10 w-80 max-w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
              />
            </div>
            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-500">No matching trends.</p>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {filtered.map((trend) => (
                  <TrendCard key={trend.id} trend={trend} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm leading-6 text-amber-900">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
      <p>
        Prices and trends are sourced from{" "}
        <a
          href="https://www.ams.usda.gov/about-ams"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline decoration-amber-400 underline-offset-2 transition hover:decoration-amber-700"
        >
          USDA Agricultural Marketing Service (AMS)
        </a>{" "}
        Market News. Each menu ingredient is automatically matched to the
        closest USDA-tracked commodity using a keyword-based heuristic; matches
        are not reviewed by humans. Displayed prices reflect the broader USDA
        commodity category (e.g., &ldquo;Cheese&rdquo;) rather than the specific
        brand, grade, or origin of the ingredient. Some ingredients have no
        USDA coverage and are skipped. Units (e.g., Dollars per Metric Ton vs Dollars per Pound) come
        straight from the source report and differ between commodities.
      </p>
    </div>
  );
}

function TrendCard({ trend }: { trend: PricingTrend }) {
  const { points, hasDates } = parseSparkline(trend.sparkline);
  const trendTone = toneForTrend(trend.trend_label);
  const reportUrl = trend.report_id
    ? `https://mymarketnews.ams.usda.gov/viewReport/${encodeURIComponent(
        trend.report_id,
      )}`
    : null;

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Commodity
          </p>
          <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-zinc-900">
            {trend.commodity_filter}
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Source:{" "}
            {reportUrl ? (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-700 underline decoration-zinc-300 underline-offset-2 transition hover:text-zinc-900 hover:decoration-zinc-500"
              >
                {trend.source}
                <span className="ml-2 font-mono text-[11px] text-zinc-400">
                  {trend.report_id}
                </span>
              </a>
            ) : (
              <>{trend.source}</>
            )}
          </p>
        </div>
        <StatusBadge status={trend.status} />
      </header>

      <LatestPriceCard
        value={trend.price_value}
        unit={trend.price_unit}
        asOf={trend.price_as_of}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FactCell
          label="Trend"
          value={trend.trend_label ? prettyLabel(trend.trend_label) : "—"}
          accent={trendTone.fg}
          icon={<TrendArrow label={trend.trend_label} />}
        />
        <FactCell
          label="30d change"
          value={formatPct(trend.change_30d_pct)}
          accent={pctTone(trend.change_30d_pct)}
        />
        <FactCell
          label="90d change"
          value={formatPct(trend.change_90d_pct)}
          accent={pctTone(trend.change_90d_pct)}
        />
      </div>

      <div className="h-44 w-full">
        {points.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 6, right: 6, bottom: 0, left: 0 }}
            >
              <defs>
                <linearGradient
                  id={`grad-${trend.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={trendTone.stroke}
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="100%"
                    stopColor={trendTone.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f4f4f5" vertical={false} />
              <XAxis
                dataKey="x"
                tick={hasDates ? { fontSize: 11, fill: "#71717a" } : false}
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                minTickGap={24}
                tickFormatter={hasDates ? formatDateShort : undefined}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717a" }}
                tickLine={false}
                axisLine={{ stroke: "#e4e4e7" }}
                width={48}
                domain={["auto", "auto"]}
                tickFormatter={(v) => formatNumber(v as number)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #e4e4e7",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                labelFormatter={(v) =>
                  hasDates ? formatDate(v as string) : `Point ${v}`
                }
                formatter={(v) => [
                  `${formatNumber(v as number)}${
                    trend.price_unit ? ` ${trend.price_unit}` : ""
                  }`,
                  "Price",
                ]}
              />
              <Area
                type="monotone"
                dataKey="y"
                stroke={trendTone.stroke}
                strokeWidth={2}
                fill={`url(#grad-${trend.id})`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400">
            {trend.status === "error"
              ? "No chart available — see error below"
              : "Not enough data points for a chart"}
          </div>
        )}
      </div>

      {trend.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {trend.error}
        </div>
      )}

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Linked ingredients
          <span className="ml-2 text-zinc-400 normal-case tracking-normal">
            ({trend.ingredients.length})
          </span>
        </p>
        {trend.ingredients.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {trend.ingredients.map((i) => (
              <span
                key={i.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-50 px-2 py-1 text-xs text-zinc-700 ring-1 ring-zinc-200"
              >
                <span className="font-medium">{i.canonical_name}</span>
                <span className="text-zinc-400">
                  · {i.category.replace("_", " ")}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-zinc-400">
            No ingredients matched the covered IDs.
          </p>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span>{trend.data_points ?? 0} data points</span>
        <span>·</span>
        <span>Captured {formatDateTime(trend.created_at)}</span>
      </footer>
    </article>
  );
}

function LatestPriceCard({
  value,
  unit,
  asOf,
}: {
  value: number | null;
  unit: string | null;
  asOf: string | null;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-5 py-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        Latest price
      </p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tabular-nums text-zinc-900">
          {value != null ? formatNumber(value) : "—"}
        </span>
        {unit && <span className="text-sm text-zinc-600">{unit}</span>}
      </div>
      {asOf && (
        <p className="mt-1 text-xs text-zinc-400">as of {formatDate(asOf)}</p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    priced: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    no_data: "bg-zinc-100 text-zinc-600 ring-zinc-200",
    error: "bg-red-50 text-red-700 ring-red-200",
  };
  const cls = styles[status] ?? "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${cls}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "rising" | "falling" | "stable";
}) {
  const accent =
    tone === "rising"
      ? "text-amber-700"
      : tone === "falling"
        ? "text-emerald-700"
        : tone === "stable"
          ? "text-zinc-700"
          : "text-zinc-900";
  return (
    <div className="flex items-baseline gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
      <span className={`text-lg font-semibold tabular-nums ${accent}`}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function FactCell({
  label,
  value,
  subtle,
  accent,
  icon,
}: {
  label: string;
  value: string;
  subtle?: string;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${
          accent ?? "text-zinc-900"
        }`}
      >
        {icon}
        <span className="truncate">{value}</span>
      </p>
      {subtle && <p className="mt-0.5 text-[11px] text-zinc-400">{subtle}</p>}
    </div>
  );
}

function TrendArrow({ label }: { label: string | null }) {
  if (label === "rising") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M7 17 17 7" />
        <path d="M9 7h8v8" />
      </svg>
    );
  }
  if (label === "falling") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M7 7 17 17" />
        <path d="M17 9v8h-8" />
      </svg>
    );
  }
  if (label === "stable") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-3.5 w-3.5"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    );
  }
  return null;
}

function toneForTrend(label: string | null): {
  fg: string;
  stroke: string;
} {
  switch (label) {
    case "rising":
      return { fg: "text-amber-700", stroke: "#b45309" };
    case "falling":
      return { fg: "text-emerald-700", stroke: "#047857" };
    case "stable":
      return { fg: "text-zinc-700", stroke: "#52525b" };
    default:
      return { fg: "text-zinc-500", stroke: "#a1a1aa" };
  }
}

function pctTone(pct: number | null): string {
  if (pct == null) return "text-zinc-500";
  if (pct > 0.5) return "text-amber-700";
  if (pct < -0.5) return "text-emerald-700";
  return "text-zinc-700";
}

function prettyLabel(label: string): string {
  return label.replace("_", " ");
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1000) return n.toLocaleString();
  if (Math.abs(n) >= 1) return n.toFixed(2);
  return n.toFixed(3);
}

function formatPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatDate(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d: string): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseSparkline(raw: unknown): ParsedSparkline {
  if (!raw) return { points: [], hasDates: false };
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return { points: [], hasDates: false };
    }
  }
  if (!Array.isArray(data)) return { points: [], hasDates: false };

  if (
    data.length > 0 &&
    data.every((e) => typeof e === "number" && Number.isFinite(e))
  ) {
    return {
      points: (data as number[]).map((v, i) => ({ x: String(i + 1), y: v })),
      hasDates: false,
    };
  }

  const points: SparklinePoint[] = [];
  for (const entry of data) {
    if (entry == null) continue;

    if (Array.isArray(entry) && entry.length >= 2) {
      const [d, v] = entry;
      const value = Number(v);
      if (typeof d === "string" && Number.isFinite(value)) {
        points.push({ x: d, y: value });
      }
      continue;
    }

    if (typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      const d =
        obj.date ??
        obj.week_ending ??
        obj.d ??
        obj.t ??
        obj.time ??
        obj.timestamp ??
        obj.as_of;
      const v =
        obj.value ?? obj.price ?? obj.price_value ?? obj.v ?? obj.y ?? obj.p;
      const value = Number(v);
      if (typeof d === "string" && Number.isFinite(value)) {
        points.push({ x: d, y: value });
      }
    }
  }

  points.sort((a, b) => a.x.localeCompare(b.x));
  return { points, hasDates: points.length > 0 };
}
