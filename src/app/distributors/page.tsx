"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/EmptyState";

type Confidence = "high" | "medium";

type LinkedIngredient = {
  id: number;
  canonical_name: string;
  category: string;
  unit: string;
  confidence: Confidence;
};

type Ingredient = {
  id: number;
  canonical_name: string;
  category: string;
  unit: string;
};

type Distributor = {
  id: number;
  place_id: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  verification_method: string;
  discovery_source: string;
  categories: string[];
  verified_categories: string[];
  linked_ingredients: LinkedIngredient[];
  rfp_count: number;
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

type GeoState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "granted"; lat: number; lng: number }
  | { status: "denied"; message: string };

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function DistributorsPage() {
  const router = useRouter();
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [rfpRequestsCount, setRfpRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedIngredientIds, setSelectedIngredientIds] = useState<
    Set<number>
  >(new Set());

  const [geo, setGeo] = useState<GeoState>({ status: "idle" });

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeo({ status: "denied", message: "Geolocation not supported" });
      return;
    }
    setGeo({ status: "pending" });
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGeo({
          status: "granted",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) =>
        setGeo({
          status: "denied",
          message: err.message || "Location permission denied",
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/distributors")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setDistributors(data.distributors ?? []);
        setIngredients(data.ingredients ?? []);
        setRfpRequestsCount(data.rfp_requests_count ?? 0);
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

  const ingredientsById = useMemo(() => {
    const m = new Map<number, Ingredient>();
    for (const i of ingredients) m.set(i.id, i);
    return m;
  }, [ingredients]);

  const ingredientsByCategory = useMemo(() => {
    const m = new Map<string, Ingredient[]>();
    for (const i of ingredients) {
      const arr = m.get(i.category) ?? [];
      arr.push(i);
      m.set(i.category, arr);
    }
    return m;
  }, [ingredients]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    for (const d of distributors) {
      for (const c of d.verified_categories) set.add(c);
      for (const c of d.categories) set.add(c);
    }
    for (const i of ingredients) set.add(i.category);
    return Array.from(set).sort();
  }, [distributors, ingredients]);

  const enriched = useMemo(() => {
    const userLoc = geo.status === "granted" ? geo : null;
    const items = distributors.map((d) => {
      const linkedIds = new Set(d.linked_ingredients.map((li) => li.id));
      const high = d.linked_ingredients.filter((i) => i.confidence === "high");
      const medium = d.linked_ingredients.filter(
        (i) => i.confidence === "medium",
      );
      const low: Ingredient[] = [];
      const cats = d.verified_categories.length
        ? d.verified_categories
        : d.categories;
      for (const cat of cats) {
        const inCat = ingredientsByCategory.get(cat) ?? [];
        for (const ing of inCat) {
          if (!linkedIds.has(ing.id)) low.push(ing);
        }
      }
      const distanceMi =
        userLoc && d.lat != null && d.lng != null
          ? haversineMiles(userLoc.lat, userLoc.lng, d.lat, d.lng)
          : null;
      return { distributor: d, high, medium, low, distanceMi };
    });
    items.sort((a, b) => {
      if (a.distanceMi == null && b.distanceMi == null) {
        return a.distributor.name.localeCompare(b.distributor.name);
      }
      if (a.distanceMi == null) return 1;
      if (b.distanceMi == null) return -1;
      return a.distanceMi - b.distanceMi;
    });
    return items;
  }, [distributors, ingredientsByCategory, geo]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter(({ distributor: d, high, medium, low }) => {
      if (q && !d.name.toLowerCase().includes(q)) return false;

      if (selectedCategories.size > 0) {
        const dCats = new Set([...d.verified_categories, ...d.categories]);
        let matches = false;
        for (const c of selectedCategories) {
          if (dCats.has(c)) {
            matches = true;
            break;
          }
        }
        if (!matches) return false;
      }

      if (selectedIngredientIds.size > 0) {
        const allIds = new Set<number>();
        for (const i of high) allIds.add(i.id);
        for (const i of medium) allIds.add(i.id);
        for (const i of low) allIds.add(i.id);
        let matches = false;
        for (const id of selectedIngredientIds) {
          if (allIds.has(id)) {
            matches = true;
            break;
          }
        }
        if (!matches) return false;
      }

      return true;
    });
  }, [enriched, query, selectedCategories, selectedIngredientIds]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading distributors…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (distributors.length === 0) return <EmptyState />;

  const toggleCategory = (c: string) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const toggleIngredient = (id: number) => {
    setSelectedIngredientIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearIngredients = () => setSelectedIngredientIds(new Set());

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
            Distributors
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {distributors.length} distributor
            {distributors.length === 1 ? "" : "s"} {" "}discovered. Each card shows
            which ingredients we&apos;re confident they sell.
          </p>
        </div>
        {rfpRequestsCount === 0 && (
          <button
            type="button"
            onClick={() => router.push("/?autorun=rfps")}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <MailIcon className="h-4 w-4" />
            Send Email
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search distributors by name…"
            className="h-10 w-72 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />

          <IngredientMultiSelect
            ingredients={ingredients}
            selectedIds={selectedIngredientIds}
            onToggle={toggleIngredient}
            onClear={clearIngredients}
          />

          {selectedCategories.size > 0 || selectedIngredientIds.size > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelectedCategories(new Set());
                setSelectedIngredientIds(new Set());
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Reset filters
            </button>
          ) : null}
        </div>

        <div className="mb-6 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedCategories(new Set())}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              selectedCategories.size === 0
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
            }`}
          >
            all
          </button>
          {allCategories.map((c) => {
            const active = selectedCategories.has(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => toggleCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {CATEGORY_LABELS[c] ?? c.replace("_", " ")}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-zinc-500">
            Showing {filtered.length} of {distributors.length}
          </p>
          <p className="text-xs text-zinc-500">
            {geo.status === "pending" && "Getting your location…"}
            {geo.status === "granted" && "Sorted by distance from you"}
            {geo.status === "denied" &&
              `Distance unavailable — ${geo.message}`}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
            No distributors match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map(({ distributor, high, medium, low, distanceMi }) => (
              <DistributorCard
                key={distributor.id}
                distributor={distributor}
                high={high}
                medium={medium}
                low={low}
                distanceMi={distanceMi}
                ingredientsById={ingredientsById}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DistributorCard({
  distributor: d,
  high,
  medium,
  low,
  distanceMi,
}: {
  distributor: Distributor;
  high: LinkedIngredient[];
  medium: LinkedIngredient[];
  low: Ingredient[];
  distanceMi: number | null;
  ingredientsById: Map<number, Ingredient>;
}) {
  const cats = d.verified_categories.length
    ? d.verified_categories
    : d.categories;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {d.rfp_count > 0 && (
        <div className="flex items-center gap-2 border-b border-sky-200 bg-gradient-to-r from-sky-100 to-sky-50 px-6 py-2.5 text-sm font-semibold text-sky-900">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          Email sent
          {d.rfp_count > 1 && (
            <span className="text-xs font-normal text-sky-700">
              · {d.rfp_count} requests
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
              {d.name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-zinc-500">
              {d.rating != null && (
                <span className="inline-flex items-center gap-1 text-zinc-700">
                  <StarIcon className="h-4 w-4 text-amber-500" />
                  <span className="font-semibold tabular-nums">
                    {d.rating.toFixed(1)}
                  </span>
                  {d.review_count != null && (
                    <span className="text-zinc-500">
                      ({d.review_count.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
              {distanceMi != null && (
                <span className="inline-flex items-center gap-1 text-zinc-700">
                  <PinIcon className="h-4 w-4 text-zinc-400" />
                  <span className="font-semibold tabular-nums">
                    {distanceMi < 10
                      ? distanceMi.toFixed(1)
                      : Math.round(distanceMi)}{" "}
                    mi
                  </span>
                </span>
              )}
              {d.business_status && (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                    d.business_status === "OPERATIONAL"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                      : "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200"
                  }`}
                >
                  {d.business_status.replace("_", " ").toLowerCase()}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {cats.map((c) => (
              <span
                key={c}
                className="inline-flex rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700"
              >
                {CATEGORY_LABELS[c] ?? c.replace("_", " ")}
              </span>
            ))}
          </div>
        </header>

        <div className="flex flex-col gap-2 text-sm text-zinc-600">
          {d.address && (
            <div className="flex items-start gap-2.5">
              <PinIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span>{d.address}</span>
            </div>
          )}
          {d.phone && (
            <div className="flex items-center gap-2.5">
              <PhoneIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              <a
                href={`tel:${d.phone}`}
                className="hover:text-zinc-900 hover:underline"
              >
                {d.phone}
              </a>
            </div>
          )}
          {d.email && (
            <div className="flex items-center gap-2.5">
              <MailIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              <a
                href={`mailto:${d.email}`}
                className="truncate hover:text-zinc-900 hover:underline"
              >
                {d.email}
              </a>
            </div>
          )}
          {d.website && (
            <div className="flex items-center gap-2.5">
              <GlobeIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              <a
                href={d.website}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-zinc-900 hover:underline"
              >
                {d.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        <IngredientGroup
          label="Confirmed sells"
          accent="emerald"
          items={high.map((i) => i.canonical_name)}
        />
        <IngredientGroup
          label="Probably sells"
          accent="amber"
          items={medium.map((i) => i.canonical_name)}
        />
        <IngredientGroup
          label="Might also sell"
          accent="zinc"
          items={low.map((i) => i.canonical_name)}
          muted
        />
      </div>
    </article>
  );
}

function IngredientGroup({
  label,
  accent,
  items,
  muted,
}: {
  label: string;
  accent: "emerald" | "amber" | "zinc";
  items: string[];
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  const dot =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "amber"
        ? "bg-amber-500"
        : "bg-zinc-400";
  const chipClass =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : accent === "amber"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-zinc-50 text-zinc-600 ring-zinc-200";

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            muted ? "text-zinc-500" : "text-zinc-700"
          }`}
        >
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-zinc-400">
          {items.length}
        </span>
      </div>
      <ChipRow items={items} chipClass={chipClass} />
    </div>
  );
}

function ChipRow({
  items,
  chipClass,
}: {
  items: string[];
  chipClass: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState(items.length);
  const [expanded, setExpanded] = useState(false);

  const itemsKey = items.join(" ");

  useEffect(() => {
    setExpanded(false);
    setVisibleCount(items.length);
  }, [itemsKey, items.length]);

  useLayoutEffect(() => {
    if (expanded) return;
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const chipEls = Array.from(
        el.querySelectorAll<HTMLElement>('[data-chip="true"]'),
      );
      const badgeEl = el.querySelector<HTMLElement>('[data-badge="true"]');
      if (chipEls.length === 0) return;

      const firstTop = chipEls[0].offsetTop;
      let onLine1 = chipEls.length;
      for (let i = 0; i < chipEls.length; i++) {
        if (chipEls[i].offsetTop !== firstTop) {
          onLine1 = i;
          break;
        }
      }

      let target = onLine1;
      if (badgeEl && badgeEl.offsetTop !== firstTop && target > 1) {
        target -= 1;
      }

      target = Math.max(1, Math.min(items.length, target));
      setVisibleCount((prev) => (prev === target ? prev : target));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [itemsKey, items.length, expanded]);

  const showItems = expanded ? items : items.slice(0, visibleCount);
  const hidden = items.length - visibleCount;

  if (expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(false)}
        title="Click to collapse"
        className="flex w-full flex-wrap items-center gap-1 rounded-md text-left transition hover:bg-zinc-50/60"
      >
        {items.map((name) => (
          <span
            key={name}
            className={`inline-flex rounded-md px-2 py-0.5 text-xs ring-1 ${chipClass}`}
          >
            {name}
          </span>
        ))}
      </button>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-wrap items-center gap-1">
      {showItems.map((name) => (
        <span
          key={name}
          data-chip="true"
          className={`inline-flex rounded-md px-2 py-0.5 text-xs ring-1 ${chipClass}`}
        >
          {name}
        </span>
      ))}
      {hidden > 0 && (
        <button
          type="button"
          data-badge="true"
          onClick={() => setExpanded(true)}
          className="inline-flex rounded-md bg-white px-2 py-0.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-300 transition hover:bg-zinc-50 hover:text-zinc-900"
        >
          +{hidden}
        </button>
      )}
    </div>
  );
}

function IngredientMultiSelect({
  ingredients,
  selectedIds,
  onToggle,
  onClear,
}: {
  ingredients: Ingredient[];
  selectedIds: Set<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) =>
      i.canonical_name.toLowerCase().includes(q),
    );
  }, [filter, ingredients]);

  const count = selectedIds.size;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 transition hover:bg-zinc-50"
      >
        <span>
          {count === 0
            ? "Filter by ingredient"
            : `${count} ingredient${count === 1 ? "" : "s"} selected`}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 text-zinc-500 transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
          <div className="border-b border-zinc-100 p-2">
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search ingredients…"
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">
                No ingredients
              </div>
            ) : (
              filtered.map((i) => {
                const checked = selectedIds.has(i.id);
                return (
                  <label
                    key={i.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(i.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span className="flex-1 truncate text-zinc-800">
                      {i.canonical_name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                      {i.category.replace("_", " ")}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {count > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2">
              <span className="text-xs text-zinc-500">
                {count} selected
              </span>
              <button
                type="button"
                onClick={onClear}
                className="text-xs font-medium text-zinc-700 hover:text-zinc-900"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="m12 17.3-6.18 3.7 1.64-7.03L2 9.24l7.19-.62L12 2l2.81 6.62 7.19.62-5.46 4.73 1.64 7.03Z" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
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
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
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
      <path d="M22 16.92V21a1 1 0 0 1-1.1 1 19.9 19.9 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.9 19.9 0 0 1 3.2 4.1 1 1 0 0 1 4.2 3h4.09a1 1 0 0 1 1 .75l1 4a1 1 0 0 1-.27 1L8.21 10.5a16 16 0 0 0 6 6l1.75-1.78a1 1 0 0 1 1-.27l4 1a1 1 0 0 1 .75 1Z" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
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

function GlobeIcon({ className }: { className?: string }) {
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
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}
