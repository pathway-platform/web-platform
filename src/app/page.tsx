"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const steps = [
  {
    id: 1,
    title: "Menu Ingestion",
    description: "Import items from a menu URL.",
  },
  {
    id: 2,
    title: "Pricing Trends",
    description: "Track and analyze pricing.",
  },
];

type PipelineStatus = {
  menu_items_count: number;
  pricing_trends_count: number;
};

type MenuItem = {
  id: number;
  item_name: string;
  item_desc: string;
  price: string;
  servings_per_day: number;
  serving_size: string | null;
};

export default function Home() {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [forceFlow, setForceFlow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pipeline-status")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) {
          setStatus({
            menu_items_count: data.menu_items_count ?? 0,
            pricing_trends_count: data.pricing_trends_count ?? 0,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ menu_items_count: 0, pricing_trends_count: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (statusLoading || status === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Checking pipeline status…</p>
      </div>
    );
  }

  const hasMenu = status.menu_items_count > 0;
  const hasPricing = status.pricing_trends_count > 0;

  if (hasMenu && hasPricing && !forceFlow) {
    return <DataExistsView status={status} onRerun={() => setForceFlow(true)} />;
  }

  const initialStep = hasMenu && !hasPricing ? 2 : 1;
  return <PipelineFlow initialStep={initialStep} />;
}

function PipelineFlow({ initialStep }: { initialStep: number }) {
  const [currentStep, setCurrentStep] = useState(initialStep);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onSelect={setCurrentStep}
      />

      <section className="flex flex-1 flex-col items-center px-6 py-12 sm:px-12">
        {currentStep === 1 && (
          <MenuIngestionStep onComplete={() => setCurrentStep(2)} />
        )}
        {currentStep === 2 && <PricingTrendsRunStep />}
      </section>
    </div>
  );
}

type IngestPhase = "url" | "processing" | "details";
type ProcessingStage = "parse" | "extract";

function MenuIngestionStep({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<IngestPhase>("url");
  const [menuUrl, setMenuUrl] = useState("");
  const [stage, setStage] = useState<ProcessingStage>("parse");
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);

  const runIngestion = async () => {
    setProcessingError(null);
    setPhase("processing");
    setStage("parse");
    try {
      const r1 = await fetch("/api/parse-menu-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: menuUrl }),
      });
      if (!r1.ok) {
        const body = await r1.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r1.status}`);
      }

      setStage("extract");
      const r2 = await fetch("/api/extract-recipe", { method: "POST" });
      if (!r2.ok) {
        const body = await r2.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r2.status}`);
      }

      const r3 = await fetch("/api/menu-items");
      if (!r3.ok) throw new Error(`Could not load menu items (HTTP ${r3.status})`);
      const data = await r3.json();
      setItems(data.items as MenuItem[]);
      setPhase("details");
    } catch (err) {
      setProcessingError((err as Error).message || "Pipeline failed");
    }
  };

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    runIngestion();
  };

  return (
    <>
      {phase === "url" && (
        <div className="flex flex-1 items-center">
          <UrlForm value={menuUrl} onChange={setMenuUrl} onSubmit={handleSubmitUrl} />
        </div>
      )}

      {phase === "details" && (
        <ItemsServingTable items={items} onSaved={onComplete} />
      )}

      {phase === "processing" && (
        <ProcessingModal
          stage={stage}
          error={processingError}
          onRetry={runIngestion}
          onCancel={() => {
            setPhase("url");
            setProcessingError(null);
          }}
        />
      )}
    </>
  );
}

function UrlForm({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <div className="w-full max-w-xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Ingest your menu
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          Paste a link to your menu. We&apos;ll parse the items, prices, and
          categories automatically.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <label htmlFor="menu-url" className="text-sm font-medium text-zinc-700">
          Menu URL
        </label>
        <input
          id="menu-url"
          type="url"
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/menu"
          className="mt-2 block h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
        />
        <button
          type="submit"
          disabled={!value}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ingest menu
        </button>
      </form>
    </div>
  );
}

function ProcessingModal({
  stage,
  error,
  onRetry,
  onCancel,
}: {
  stage: ProcessingStage;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const phases: { key: ProcessingStage; title: string; description: string }[] = [
    {
      key: "parse",
      title: "Scraping the menu",
      description:
        "This usually takes 10–30 seconds.",
    },
    {
      key: "extract",
      title: "Generating recipes and extracting ingredients",
      description:
        "Building recipes and normalizing ingredients for every item. Hang tight, this can take a few minutes.",
    },
  ];
  const currentPhaseIdx = phases.findIndex((p) => p.key === stage);
  const currentPhase = phases[currentPhaseIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        {error ? (
          <>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-red-600"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-zinc-900">
                  Pipeline failed
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {currentPhase.title.toLowerCase()} step did not complete.
                </p>
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
              >
                Retry
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <Spinner className="mt-0.5 h-6 w-6 text-zinc-700" />
              <div className="flex-1">
                <h2 className="text-base font-semibold text-zinc-900">
                  {currentPhase.title}…
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {currentPhase.description}
                </p>
              </div>
            </div>
            <ol className="mt-5 flex flex-col gap-2">
              {phases.map((p, idx) => {
                const done = idx < currentPhaseIdx;
                const active = idx === currentPhaseIdx;
                return (
                  <li
                    key={p.key}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-zinc-900 text-white"
                          : active
                            ? "bg-zinc-900 text-white"
                            : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {done ? <CheckIcon className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={
                        active
                          ? "font-medium text-zinc-900"
                          : done
                            ? "text-zinc-700"
                            : "text-zinc-400"
                      }
                    >
                      {p.title}
                    </span>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}

function ItemsServingTable({
  items,
  onSaved,
}: {
  items: MenuItem[];
  onSaved: () => void;
}) {
  const [drafts, setDrafts] = useState<
    Record<number, { servings_per_day: string; serving_size: string }>
  >(() => {
    const init: Record<number, { servings_per_day: string; serving_size: string }> =
      {};
    for (const it of items) {
      init[it.id] = {
        servings_per_day: String(it.servings_per_day ?? 1),
        serving_size: it.serving_size ?? "",
      };
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateDraft = (
    id: number,
    field: "servings_per_day" | "serving_size",
    value: string,
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = items.map((it) => {
        const d = drafts[it.id] ?? {
          servings_per_day: String(it.servings_per_day ?? 1),
          serving_size: it.serving_size ?? "",
        };
        const spdNum = Number(d.servings_per_day);
        return {
          id: it.id,
          servings_per_day: Number.isFinite(spdNum) && spdNum >= 0 ? spdNum : 1,
          serving_size: d.serving_size.trim() === "" ? null : d.serving_size.trim(),
        };
      });
      const r = await fetch("/api/menu-items", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: payload }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      onSaved();
    } catch (err) {
      setError((err as Error).message || "Failed to save");
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="w-full max-w-xl text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          No items extracted
        </h1>
        <p className="mt-3 text-sm text-zinc-600">
          The menu URL parsed successfully but no items were extracted. Try a
          different URL.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
          Add serving details
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          We extracted{" "}
          <span className="font-semibold text-zinc-900">{items.length}</span>{" "}
          item{items.length === 1 ? "" : "s"}. Set serving size and daily
          servings for each, these power downstream distributor quotes.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Item</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="w-44 px-4 py-3 font-medium">Serving size</th>
                <th className="w-36 px-4 py-3 font-medium">Servings / day</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const d = drafts[it.id] ?? {
                  servings_per_day: "1",
                  serving_size: "",
                };
                return (
                  <tr key={it.id} className="border-t border-zinc-100 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">
                        {it.item_name}
                      </div>
                      {it.item_desc && (
                        <div className="mt-0.5 line-clamp-2 max-w-md text-xs text-zinc-500">
                          {it.item_desc}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">
                      {it.price || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={d.serving_size}
                        onChange={(e) =>
                          updateDraft(it.id, "serving_size", e.target.value)
                        }
                        placeholder="e.g. 8 slices"
                        className="block h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={d.servings_per_day}
                        onChange={(e) =>
                          updateDraft(it.id, "servings_per_day", e.target.value)
                        }
                        className="block h-9 w-full rounded-md border border-zinc-300 bg-white px-2 text-sm tabular-nums outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Spinner className="h-4 w-4" />}
          {saving ? "Saving…" : "Save and continue"}
        </button>
      </div>
    </div>
  );
}

function PricingTrendsRunStep() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await fetch("/api/run-pricing-trends");
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
      }
      router.push("/pricing-trends");
    } catch (err) {
      setError((err as Error).message || "Failed to run pricing trends");
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-1 items-center">
      <div className="w-full max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Check current market pricing trends
        </h1>
        <p className="mt-3 text-base text-zinc-600">
          Pull the latest USDA AMS prices for every ingredient and compute
          30-day and 90-day trends.
        </p>

        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-zinc-900 px-6 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running && <Spinner className="h-4 w-4" />}
          {running ? "Fetching trends…" : "Run pricing trends"}
        </button>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-left text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function DataExistsView({
  status,
  onRerun,
}: {
  status: PipelineStatus;
  onRerun: () => void;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setResetting(true);
    setResetError(null);
    try {
      const r = await fetch("/api/pipeline-reset", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${r.status}`);
      }
      onRerun();
    } catch (err) {
      setResetError((err as Error).message || "Failed to reset");
      setResetting(false);
    }
  };

  return (
    <>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-lg flex-col items-center text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 text-emerald-700"
              aria-hidden="true"
            >
              <path d="m5 12 5 5 9-11" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Pipeline already complete
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Your menu and pricing trend data are already populated. Re-running
            the pipeline will start a fresh ingestion from a new menu URL.
          </p>

          <div className="mt-6 flex gap-3 text-sm text-zinc-700">
            <span className="rounded-full bg-zinc-100 px-3 py-1">
              <span className="font-semibold tabular-nums text-zinc-900">
                {status.menu_items_count}
              </span>{" "}
              menu items
            </span>
            <span className="rounded-full bg-zinc-100 px-3 py-1">
              <span className="font-semibold tabular-nums text-zinc-900">
                {status.pricing_trends_count}
              </span>{" "}
              pricing reports
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15.5 6.3L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            Re-run pipeline
          </button>
        </div>
      </div>

      {showConfirm && (
        <ConfirmResetModal
          onCancel={() => {
            if (!resetting) {
              setShowConfirm(false);
              setResetError(null);
            }
          }}
          onConfirm={handleConfirm}
          loading={resetting}
          error={resetError}
        />
      )}
    </>
  );
}

function ConfirmResetModal({
  onCancel,
  onConfirm,
  loading,
  error,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loading, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-reset-title"
    >
      <div
        className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl ring-1 ring-zinc-200">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-red-600"
              aria-hidden="true"
            >
              <path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="flex-1">
            <h2
              id="confirm-reset-title"
              className="text-base font-semibold text-zinc-900"
            >
              Re-run pipeline?
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              This will{" "}
              <span className="font-medium text-zinc-900">
                clear all existing data
              </span>{" "}
              , including menu items, recipes, ingredients, and pricing trends. This
              cannot be undone.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? "Clearing data…" : "Yes, clear and re-run"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  steps,
  currentStep,
  onSelect,
}: {
  steps: { id: number; title: string; description: string }[];
  currentStep: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-10 sm:px-12 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Pipeline
        </p>
        <h2 className="mb-8 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Menu → Pricing
        </h2>

        <ol className="flex items-start gap-5">
          {steps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isComplete = step.id < currentStep;
            const isLast = idx === steps.length - 1;

            return (
              <li key={step.id} className="flex flex-1 items-start gap-5">
                <button
                  type="button"
                  onClick={() => onSelect(step.id)}
                  className="group flex flex-1 items-start gap-4 text-left"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold transition ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : isComplete
                          ? "border-zinc-900 bg-white text-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-400 group-hover:border-zinc-400"
                    }`}
                  >
                    {isComplete ? <CheckIcon className="h-5 w-5" /> : step.id}
                  </span>
                  <span className="flex flex-col pt-0.5">
                    <span
                      className={`text-base font-semibold tracking-tight ${
                        isActive || isComplete ? "text-zinc-900" : "text-zinc-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    <span className="mt-0.5 text-sm text-zinc-500">
                      {step.description}
                    </span>
                  </span>
                </button>

                {!isLast && (
                  <div
                    className={`mt-6 h-0.5 flex-1 rounded-full ${
                      isComplete ? "bg-zinc-900" : "bg-zinc-200"
                    }`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.2-8.55" />
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
