"use client";

import { useEffect, useState } from "react";
import EmptyState from "@/components/EmptyState";

type MenuListItem = {
  id: number;
  item_name: string;
  item_desc: string;
  price: string;
  servings_per_day: number;
  serving_size: string | null;
};

type Ingredient = {
  id: number;
  canonical_name: string;
  category: string;
  unit: string;
  daily_quantity: number;
};

type MenuItemDetail = MenuListItem & {
  recipe_steps: string[] | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  ingredients: Ingredient[];
};

export default function MenuPage() {
  const [items, setItems] = useState<MenuListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<MenuItemDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);
    fetch("/api/menu-items")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setListError(null);
        if (data.items.length > 0 && selectedId === null) {
          setSelectedId(data.items[0].id);
        }
      })
      .catch((err) => {
        if (!cancelled) setListError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/menu-items/${selectedId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setDetail(data.item);
      })
      .catch((err) => {
        if (!cancelled) setDetailError(err.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (!listLoading && !listError && items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Menu
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse menu items and inspect their recipes and ingredients.
        </p>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0 overflow-y-auto border-r border-zinc-200 bg-white">
          {listLoading ? (
            <p className="p-6 text-sm text-zinc-500">Loading items…</p>
          ) : listError ? (
            <p className="p-6 text-sm text-red-600">Error: {listError}</p>
          ) : items.length === 0 ? (
            <p className="p-6 text-sm text-zinc-500">No menu items yet.</p>
          ) : (
            <ul>
              {items.map((item) => {
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`flex w-full flex-col gap-1 border-b border-zinc-100 px-5 py-4 text-left transition ${
                        active
                          ? "bg-zinc-100"
                          : "hover:bg-zinc-50"
                      }`}
                    >
                      <span className="text-sm font-medium text-zinc-900">
                        {item.item_name}
                      </span>
                      {item.price && (
                        <span className="text-xs text-zinc-500">
                          {item.price}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-[var(--background)]">
          {selectedId === null ? (
            <p className="p-12 text-sm text-zinc-500">
              Select an item to see its details.
            </p>
          ) : detailLoading ? (
            <p className="p-12 text-sm text-zinc-500">Loading details…</p>
          ) : detailError ? (
            <p className="p-12 text-sm text-red-600">Error: {detailError}</p>
          ) : detail ? (
            <ItemDetail detail={detail} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ItemDetail({ detail }: { detail: MenuItemDetail }) {
  const totalMinutes =
    (detail.prep_time_minutes ?? 0) + (detail.cook_time_minutes ?? 0);

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="mb-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
            {detail.item_name}
          </h2>
          {detail.price && (
            <span className="rounded-full bg-zinc-900 px-3 py-1 text-sm font-medium text-white">
              {detail.price}
            </span>
          )}
        </div>
        {detail.item_desc && (
          <p className="mt-3 text-base leading-relaxed text-zinc-600">
            {detail.item_desc}
          </p>
        )}
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Serving size" value={detail.serving_size ?? "—"} />
        <Stat
          label="Servings / day"
          value={
            detail.servings_per_day != null
              ? String(detail.servings_per_day)
              : "—"
          }
        />
        <Stat
          label="Prep time"
          value={
            detail.prep_time_minutes !== null
              ? `${detail.prep_time_minutes} min`
              : "—"
          }
        />
        <Stat
          label="Cook time"
          value={
            detail.cook_time_minutes !== null
              ? `${detail.cook_time_minutes} min`
              : "—"
          }
        />
        <Stat
          label="Total time"
          value={totalMinutes > 0 ? `${totalMinutes} min` : "—"}
        />
      </div>

      <Section title="Recipe">
        {detail.recipe_steps && detail.recipe_steps.length > 0 ? (
          <ol className="flex flex-col gap-3">
            {detail.recipe_steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <p className="text-sm leading-6 text-zinc-700">{step}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-zinc-500">No recipe yet.</p>
        )}
      </Section>

      <Section title="Ingredients">
        {detail.ingredients.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ingredient</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Daily qty
                  </th>
                </tr>
              </thead>
              <tbody>
                {detail.ingredients.map((ing) => (
                  <tr
                    key={ing.id}
                    className="border-t border-zinc-100 text-zinc-800"
                  >
                    <td className="px-4 py-3 font-medium">
                      {ing.canonical_name}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">
                      <CategoryBadge category={ing.category} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                      {ing.daily_quantity.toFixed(2)} {ing.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No ingredients linked.</p>
        )}
      </Section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-900">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
      {category.replace("_", " ")}
    </span>
  );
}
