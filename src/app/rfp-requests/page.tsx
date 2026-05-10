"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "@/components/EmptyState";

type LineItem = {
  id: number;
  ingredient_id: number;
  ingredient_name: string;
  category: string;
  quantity: number;
  unit: string;
  window_days: number;
  is_upsell: boolean;
};

type Rfp = {
  id: number;
  distributor_id: number;
  distributor_name: string;
  distributor_address: string | null;
  distributor_email: string | null;
  distributor_phone: string | null;
  distributor_website: string | null;
  distributor_categories: string[];
  recipient_email: string;
  used_fallback_email: boolean;
  sent_at: string;
  deadline_at: string;
  status: string;
  subject: string;
  body: string;
  message_id: string | null;
  line_items: LineItem[];
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

export default function RfpRequestsPage() {
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedDistributorIds, setSelectedDistributorIds] = useState<
    Set<number>
  >(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/rfp-requests")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setRfps(data.rfps ?? []);
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

  const distributors = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of rfps) m.set(r.distributor_id, r.distributor_name);
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [rfps]);

  const allStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const r of rfps) set.add(r.status);
    return Array.from(set).sort();
  }, [rfps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rfps.filter((r) => {
      if (q) {
        const inName = r.distributor_name.toLowerCase().includes(q);
        const inSubject = r.subject.toLowerCase().includes(q);
        const inIngredient = r.line_items.some((li) =>
          li.ingredient_name.toLowerCase().includes(q),
        );
        if (!inName && !inSubject && !inIngredient) return false;
      }
      if (
        selectedDistributorIds.size > 0 &&
        !selectedDistributorIds.has(r.distributor_id)
      ) {
        return false;
      }
      if (selectedStatuses.size > 0 && !selectedStatuses.has(r.status)) {
        return false;
      }
      return true;
    });
  }, [rfps, query, selectedDistributorIds, selectedStatuses]);

  const totalLineItems = useMemo(
    () => filtered.reduce((acc, r) => acc + r.line_items.length, 0),
    [filtered],
  );

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Loading RFP requests…</p>
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

  if (rfps.length === 0) return <EmptyState />;

  const toggleStatus = (s: string) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleDistributor = (id: number) => {
    setSelectedDistributorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          RFP Requests
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {rfps.length} request{rfps.length === 1 ? "" : "s"} sent across{" "}
          {distributors.length} distributor
          {distributors.length === 1 ? "" : "s"}.
        </p>
      </header>

      <div className="flex flex-1 flex-col px-6 py-6 sm:px-12">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by distributor, subject, or ingredient…"
            className="h-10 w-80 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
          />

          <DistributorMultiSelect
            distributors={distributors}
            selectedIds={selectedDistributorIds}
            onToggle={toggleDistributor}
            onClear={() => setSelectedDistributorIds(new Set())}
          />

          {selectedDistributorIds.size > 0 || selectedStatuses.size > 0 ? (
            <button
              type="button"
              onClick={() => {
                setSelectedDistributorIds(new Set());
                setSelectedStatuses(new Set());
              }}
              className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
            >
              Reset filters
            </button>
          ) : null}
        </div>

        {allStatuses.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedStatuses(new Set())}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                selectedStatuses.size === 0
                  ? "bg-zinc-900 text-white"
                  : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
              }`}
            >
              all
            </button>
            {allStatuses.map((s) => {
              const active = selectedStatuses.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    active
                      ? "bg-zinc-900 text-white"
                      : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}

        <p className="mb-4 text-xs text-zinc-500">
          Showing {filtered.length} of {rfps.length} · {totalLineItems} line
          item{totalLineItems === 1 ? "" : "s"}
        </p>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center text-sm text-zinc-500">
            No RFP requests match the current filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map((rfp) => (
              <RfpCard key={rfp.id} rfp={rfp} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RfpCard({ rfp }: { rfp: Rfp }) {
  const [bodyOpen, setBodyOpen] = useState(false);

  const sent = new Date(rfp.sent_at);
  const deadline = new Date(rfp.deadline_at);
  const now = Date.now();
  const overdue = deadline.getTime() < now;
  const daysLeft = Math.ceil((deadline.getTime() - now) / (1000 * 60 * 60 * 24));

  const longShotCount = rfp.line_items.filter((li) => li.is_upsell).length;
  const coreCount = rfp.line_items.length - longShotCount;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-5 p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold tracking-tight text-zinc-900">
              {rfp.distributor_name}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-zinc-500">
              <StatusBadge status={rfp.status} />
              <span className="inline-flex items-center gap-1 text-zinc-700">
                <SendIcon className="h-4 w-4 text-zinc-400" />
                Sent {formatDate(sent)}
              </span>
              <span
                className={`inline-flex items-center gap-1 ${
                  overdue ? "text-red-700" : "text-zinc-700"
                }`}
              >
                <ClockIcon
                  className={`h-4 w-4 ${
                    overdue ? "text-red-500" : "text-zinc-400"
                  }`}
                />
                {overdue
                  ? `Overdue ${formatDate(deadline)}`
                  : `Due ${formatDate(deadline)}${
                      daysLeft >= 0 ? ` · ${daysLeft}d` : ""
                    }`}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            {rfp.distributor_categories.map((c) => (
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
          <div className="flex items-center gap-2.5">
            <MailIcon className="h-4 w-4 shrink-0 text-zinc-400" />
            <a
              href={`mailto:${rfp.recipient_email}`}
              className="truncate hover:text-zinc-900 hover:underline"
            >
              {rfp.recipient_email}
            </a>
          </div>
          <div className="flex items-start gap-2.5">
            <SubjectIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <span className="text-zinc-800">{rfp.subject}</span>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-700">
                Order
              </span>
              <span className="text-xs text-zinc-500">
                {coreCount} item{coreCount === 1 ? "" : "s"}
                {longShotCount > 0 &&
                  ` · ${longShotCount} long shot${
                    longShotCount === 1 ? "" : "s"
                  }`}
              </span>
            </div>
          </div>
          <LineItemsTable items={rfp.line_items} />
        </div>

        {rfp.body && (
          <div className="border-t border-zinc-100 pt-3">
            <button
              type="button"
              onClick={() => setBodyOpen((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-900"
            >
              <ChevronIcon
                className={`h-3.5 w-3.5 transition ${
                  bodyOpen ? "rotate-90" : ""
                }`}
              />
              {bodyOpen ? "Hide email body" : "View email body"}
            </button>
            {bodyOpen && (
              <pre className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs leading-5 text-zinc-700 ring-1 ring-zinc-200">
                {rfp.body}
              </pre>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function LineItemsTable({ items }: { items: LineItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-200 px-3 py-4 text-center text-xs text-zinc-400">
        No line items
      </p>
    );
  }

  const PREVIEW = 3;
  const visible = expanded ? items : items.slice(0, PREVIEW);
  const hidden = items.length - visible.length;

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-zinc-200">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-medium">Ingredient</th>
            <th className="px-3 py-2 text-right font-medium">Quantity</th>
            <th className="px-3 py-2 text-right font-medium">Window</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((li) => (
            <tr key={li.id} className="border-t border-zinc-100">
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900">
                    {li.ingredient_name}
                  </span>
                  {li.is_upsell && (
                    <span className="inline-flex rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-700 ring-1 ring-violet-200">
                      long shot
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500">
                  {CATEGORY_LABELS[li.category] ?? li.category.replace("_", " ")}
                </div>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-800">
                {formatQuantity(li.quantity)}{" "}
                <span className="text-zinc-500">{li.unit}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-zinc-600">
                {li.window_days}d
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center border-t border-zinc-100 bg-zinc-50/60 px-3 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "sent"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : status === "failed"
        ? "bg-red-50 text-red-700 ring-red-200"
        : "bg-zinc-100 text-zinc-700 ring-zinc-200";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1 ${classes}`}
    >
      {status}
    </span>
  );
}

function DistributorMultiSelect({
  distributors,
  selectedIds,
  onToggle,
  onClear,
}: {
  distributors: { id: number; name: string }[];
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
    if (!q) return distributors;
    return distributors.filter((d) => d.name.toLowerCase().includes(q));
  }, [filter, distributors]);

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
            ? "Filter by distributor"
            : `${count} distributor${count === 1 ? "" : "s"} selected`}
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
              placeholder="Search distributors…"
              className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-zinc-500">
                No distributors
              </div>
            ) : (
              filtered.map((d) => {
                const checked = selectedIds.has(d.id);
                return (
                  <label
                    key={d.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-zinc-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(d.id)}
                      className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span className="flex-1 truncate text-zinc-800">
                      {d.name}
                    </span>
                  </label>
                );
              })
            )}
          </div>
          {count > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-100 px-3 py-2">
              <span className="text-xs text-zinc-500">{count} selected</span>
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

function formatDate(d: Date): string {
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatQuantity(q: number): string {
  if (q >= 100) return Math.round(q).toString();
  if (q >= 10) return q.toFixed(1).replace(/\.0$/, "");
  return q.toFixed(2).replace(/\.?0+$/, "");
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

function SendIcon({ className }: { className?: string }) {
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
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
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

function SubjectIcon({ className }: { className?: string }) {
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
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
