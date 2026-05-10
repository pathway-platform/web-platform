"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";

type Ingredient = {
  id: number;
  canonical_name: string;
  category: string;
  unit: string;
  daily_total_quantity: number;
  used_in: string;
  items: { id: number; name: string }[];
};

const CATEGORIES = [
  "all",
  "produce",
  "meat",
  "seafood",
  "dairy",
  "dry_goods",
  "beverages",
  "specialty",
  "utility",
] as const;

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ingredients")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setIngredients(data.ingredients);
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

  const filtered = useMemo(() => {
    return ingredients.filter((i) => {
      if (category !== "all" && i.category !== category) return false;
      if (query && !i.canonical_name.toLowerCase().includes(query.toLowerCase()))
        return false;
      return true;
    });
  }, [ingredients, category, query]);

  if (!loading && !error && ingredients.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Ingredients
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Master list of ingredients and the menu items they appear in.
        </p>
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredients…"
            className="h-10 w-72 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  category === c
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                }`}
              >
                {c.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading ingredients…</p>
        ) : error ? (
          <p className="text-sm text-red-600">Error: {error}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Ingredient</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Daily total
                  </th>
                  <th className="px-4 py-3 font-medium">Used in</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-sm text-zinc-500"
                    >
                      No matching ingredients.
                    </td>
                  </tr>
                ) : (
                  filtered.map((ing) => (
                    <tr
                      key={ing.id}
                      className="border-t border-zinc-100 align-top"
                    >
                      <td className="px-4 py-3 font-medium text-zinc-900">
                        {ing.canonical_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">
                          {ing.category.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-zinc-700">
                        {ing.daily_total_quantity.toFixed(2)} {ing.unit}
                      </td>
                      <td className="px-4 py-3">
                        {ing.items.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {ing.items.map((it) => (
                              <span
                                key={it.id}
                                className="inline-flex rounded-md bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200"
                              >
                                {it.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
