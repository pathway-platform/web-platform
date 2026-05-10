"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";

type Candidate = {
  distributor_id: number;
  distributor_name: string;
  unit_price: number;
  currency: string | null;
  price_unit: string;
  minimum_order_qty: number | null;
  minimum_order_unit: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  score: number;
  is_recommended: boolean;
};

type PerIngredient = {
  ingredient_id: number;
  ingredient_name: string;
  category: string;
  quantity_requested: number;
  unit_requested: string;
  recommended_distributor_id: number;
  candidates: Candidate[];
};

type OrderItem = {
  ingredient_id: number;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  currency: string | null;
  subtotal: number;
};

type RecommendedOrder = {
  distributor_id: number;
  distributor_name: string;
  ingredients: OrderItem[];
  subtotal: number;
};

type RecommendationsResponse = {
  weights: Record<string, number>;
  include_partial: boolean;
  currency: string | null;
  per_ingredient: PerIngredient[];
  recommended_orders: RecommendedOrder[];
  total_estimated_cost: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  produce: "produce",
  meat: "meat",
  seafood: "seafood",
  dairy: "dairy",
  dry_goods: "dry goods",
  beverages: "beverages",
  specialty: "specialty",
  utility: "utility",
};

export default function RecommendationsPage() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/recommendations")
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d) => {
        if (!cancelled) setData(d as RecommendationsResponse);
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

  const orderByDistributor = useMemo(() => {
    const m = new Map<number, RecommendedOrder>();
    for (const o of data?.recommended_orders ?? []) m.set(o.distributor_id, o);
    return m;
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.per_ingredient ?? [];
    if (!q) return list;
    return list.filter(
      (pi) =>
        pi.ingredient_name.toLowerCase().includes(q) ||
        pi.candidates.some((c) =>
          c.distributor_name.toLowerCase().includes(q),
        ),
    );
  }, [data, query]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading recommendations…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }
  if (!data || data.per_ingredient.length === 0) {
    return (
      <EmptyState message="No recommendations yet. Send RFPs and wait for distributor quotes to come in." />
    );
  }

  const defaultCurrency = data.currency;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Recommendations
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {data.per_ingredient.length} ingredient
          {data.per_ingredient.length === 1 ? "" : "s"} covered ·{" "}
          {data.recommended_orders.length} distributor
          {data.recommended_orders.length === 1 ? "" : "s"} · Total estimated{" "}
          <span className="font-semibold text-zinc-900">
            {formatCurrency(data.total_estimated_cost, defaultCurrency)}
          </span>
        </p>
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ingredient or distributor…"
            className="h-10 w-80 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <p className="text-xs text-zinc-500">
            Showing {filtered.length} of {data.per_ingredient.length}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
            No matches.
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {filtered.map((pi) => (
              <IngredientSection
                key={pi.ingredient_id}
                pi={pi}
                bundle={
                  orderByDistributor.get(pi.recommended_distributor_id) ?? null
                }
                defaultCurrency={defaultCurrency}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function IngredientSection({
  pi,
  bundle,
  defaultCurrency,
}: {
  pi: PerIngredient;
  bundle: RecommendedOrder | null;
  defaultCurrency: string | null;
}) {
  const recommended =
    pi.candidates.find((c) => c.is_recommended) ?? pi.candidates[0] ?? null;
  const others = pi.candidates.filter(
    (c) => c.distributor_id !== recommended?.distributor_id,
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          {pi.ingredient_name}
        </h2>
        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
          {CATEGORY_LABELS[pi.category] ?? pi.category.replace("_", " ")}
        </span>
        <span className="text-sm text-zinc-500">
          Requested {formatQuantity(pi.quantity_requested)}{" "}
          {pi.unit_requested}
        </span>
      </div>

      {recommended && (
        <RecommendedBanner
          ingredientName={pi.ingredient_name}
          quantityRequested={pi.quantity_requested}
          unitRequested={pi.unit_requested}
          candidate={recommended}
          bundle={bundle}
          ingredientId={pi.ingredient_id}
          defaultCurrency={defaultCurrency}
        />
      )}

      {others.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Other candidates ({others.length})
          </h3>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {others.map((c) => (
              <CandidateCard
                key={c.distributor_id}
                candidate={c}
                quantityRequested={pi.quantity_requested}
                unitRequested={pi.unit_requested}
                winnerPrice={recommended?.unit_price ?? null}
                defaultCurrency={defaultCurrency}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function RecommendedBanner({
  ingredientName,
  quantityRequested,
  unitRequested,
  candidate,
  bundle,
  ingredientId,
  defaultCurrency,
}: {
  ingredientName: string;
  quantityRequested: number;
  unitRequested: string;
  candidate: Candidate;
  bundle: RecommendedOrder | null;
  ingredientId: number;
  defaultCurrency: string | null;
}) {
  const currency = candidate.currency ?? defaultCurrency;
  const subtotal = candidate.unit_price * quantityRequested;
  const otherBundleItems =
    bundle?.ingredients.filter((i) => i.ingredient_id !== ingredientId) ?? [];

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-emerald-200 bg-gradient-to-r from-emerald-100 to-emerald-50 px-6 py-2.5 text-sm font-semibold text-emerald-900">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
          <CheckIcon className="h-3.5 w-3.5" />
        </span>
        Recommended distributor
      </div>

      <div className="flex flex-col gap-5 p-6">
        <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
          {candidate.distributor_name}
        </h3>

        <CandidateMeta candidate={candidate} defaultCurrency={defaultCurrency} />

        <div className="rounded-lg bg-zinc-50 p-4 ring-1 ring-zinc-200">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Your order for {ingredientName}
          </p>
          <p className="mt-1 text-base text-zinc-900">
            <span className="tabular-nums">
              {formatQuantity(quantityRequested)} {unitRequested}
            </span>
            {" × "}
            <span className="tabular-nums">
              {formatCurrency(candidate.unit_price, currency)}
            </span>
            {" = "}
            <span className="font-semibold tabular-nums">
              {formatCurrency(subtotal, currency)}
            </span>
          </p>
        </div>

        {bundle && otherBundleItems.length > 0 && (
          <div className="border-t border-zinc-100 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
              Also winning for {otherBundleItems.length} other ingredient
              {otherBundleItems.length === 1 ? "" : "s"} in this order
            </p>
            <ul className="mt-3 flex flex-col divide-y divide-zinc-100 rounded-lg ring-1 ring-zinc-200">
              {otherBundleItems.map((item) => (
                <li
                  key={item.ingredient_id}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="font-medium text-zinc-900">
                      {item.name}
                    </span>
                    <span className="ml-2 text-zinc-500">
                      {formatQuantity(item.quantity)} {item.unit} ×{" "}
                      {formatCurrency(
                        item.unit_price,
                        item.currency ?? defaultCurrency,
                      )}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-700">
                    {formatCurrency(
                      item.subtotal,
                      item.currency ?? defaultCurrency,
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between text-sm">
              <span className="font-medium text-zinc-700">
                Bundle subtotal
              </span>
              <span className="font-semibold tabular-nums text-zinc-900">
                {formatCurrency(bundle.subtotal, defaultCurrency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function CandidateCard({
  candidate,
  quantityRequested,
  unitRequested,
  winnerPrice,
  defaultCurrency,
}: {
  candidate: Candidate;
  quantityRequested: number;
  unitRequested: string;
  winnerPrice: number | null;
  defaultCurrency: string | null;
}) {
  const currency = candidate.currency ?? defaultCurrency;
  const subtotal = candidate.unit_price * quantityRequested;
  const priceDiff =
    winnerPrice != null ? candidate.unit_price - winnerPrice : null;

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <header>
        <h3 className="truncate text-sm font-semibold tracking-tight text-zinc-900">
          {candidate.distributor_name}
        </h3>
      </header>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums text-zinc-900">
          {formatCurrency(candidate.unit_price, currency)}
        </span>
        <span className="text-xs text-zinc-500">/ {candidate.price_unit}</span>
        {priceDiff != null && priceDiff > 0 && (
          <span className="ml-1 text-[11px] font-medium text-red-700">
            +{formatCurrency(priceDiff, currency)}
          </span>
        )}
        {priceDiff != null && priceDiff < 0 && (
          <span className="ml-1 text-[11px] font-medium text-emerald-700">
            {formatCurrency(priceDiff, currency)}
          </span>
        )}
      </div>

      <CandidateMeta
        candidate={candidate}
        defaultCurrency={defaultCurrency}
        compact
      />

      <div className="mt-3 flex items-baseline justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-500">
        <span>If sourced here</span>
        <span className="tabular-nums text-zinc-700">
          {formatQuantity(quantityRequested)} {unitRequested} ={" "}
          <span className="font-medium text-zinc-900">
            {formatCurrency(subtotal, currency)}
          </span>
        </span>
      </div>
    </article>
  );
}

function CandidateMeta({
  candidate,
  defaultCurrency,
  compact,
}: {
  candidate: Candidate;
  defaultCurrency: string | null;
  compact?: boolean;
}) {
  const currency = candidate.currency ?? defaultCurrency;
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = compact ? "text-xs" : "text-sm";
  const wrapper = compact ? "mt-2" : "";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-zinc-700 ${textSize} ${wrapper}`}
    >
      {!compact && (
        <span className="inline-flex items-center gap-1.5">
          <PriceTagIcon className={`${iconSize} text-zinc-400`} />
          <span className="font-medium tabular-nums">
            {formatCurrency(candidate.unit_price, currency)}
          </span>
          <span className="text-zinc-500">/ {candidate.price_unit}</span>
        </span>
      )}
      {candidate.lead_time_days != null && (
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon className={`${iconSize} text-zinc-400`} />
          {candidate.lead_time_days === 0
            ? "Same-day"
            : `${candidate.lead_time_days}d lead`}
        </span>
      )}
      {candidate.minimum_order_qty != null && (
        <span className="inline-flex items-center gap-1.5">
          <BoxIcon className={`${iconSize} text-zinc-400`} />
          MOQ {formatQuantity(candidate.minimum_order_qty)}
          {candidate.minimum_order_unit
            ? ` ${candidate.minimum_order_unit}`
            : ""}
        </span>
      )}
      {candidate.payment_terms && (
        <span className="inline-flex items-start gap-1.5">
          <CardIcon className={`${iconSize} mt-0.5 text-zinc-400`} />
          <span className="line-clamp-2">{candidate.payment_terms}</span>
        </span>
      )}
    </div>
  );
}

function formatCurrency(value: number, currency: string | null): string {
  if (!Number.isFinite(value)) return "—";
  const symbol = !currency || currency === "USD" ? "$" : `${currency} `;
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${symbol}${formatted}`;
}

function formatQuantity(q: number): string {
  if (!Number.isFinite(q)) return "—";
  if (q >= 100) return Math.round(q).toLocaleString();
  if (q >= 10) return q.toFixed(1).replace(/\.0$/, "");
  return q.toFixed(2).replace(/\.?0+$/, "");
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

function PriceTagIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.83 0l-7.17-7.17a2 2 0 0 1-.59-1.41V4a2 2 0 0 1 2-2h8.02a2 2 0 0 1 1.41.59l7.17 7.17a2 2 0 0 1 0 2.82Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BoxIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
      <path d="m3 8 9 5 9-5" />
      <path d="M12 13v8" />
    </svg>
  );
}

function CardIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </svg>
  );
}
