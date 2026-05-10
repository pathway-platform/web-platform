"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
    description: "Track ingredient pricing.",
  },
  {
    id: 3,
    title: "Distributors",
    description: "Discover nearby suppliers.",
  },
  {
    id: 4,
    title: "Send RFPs",
    description: "Email purchase requests.",
  },
];

type PipelineStatus = {
  menu_items_count: number;
  pricing_trends_count: number;
  distributors_count: number;
  rfp_requests_count: number;
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
  const [autoRunRfps, setAutoRunRfps] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("autorun") === "rfps") {
      setAutoRunRfps(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("autorun");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const r = await fetch("/api/pipeline-status");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setStatus({
        menu_items_count: data.menu_items_count ?? 0,
        pricing_trends_count: data.pricing_trends_count ?? 0,
        distributors_count: data.distributors_count ?? 0,
        rfp_requests_count: data.rfp_requests_count ?? 0,
      });
    } catch {
      setStatus({
        menu_items_count: 0,
        pricing_trends_count: 0,
        distributors_count: 0,
        rfp_requests_count: 0,
      });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (statusLoading || status === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-zinc-500">Checking pipeline status…</p>
      </div>
    );
  }

  const hasMenu = status.menu_items_count > 0;
  const hasPricing = status.pricing_trends_count > 0;
  const hasDistributors = status.distributors_count > 0;
  const hasRfps = status.rfp_requests_count > 0;
  const allComplete = hasMenu && hasPricing && hasDistributors && hasRfps;

  if (allComplete && !forceFlow) {
    return <DataExistsView status={status} onRerun={() => setForceFlow(true)} />;
  }

  const initialStep = !hasMenu
    ? 1
    : !hasPricing
      ? 2
      : !hasDistributors
        ? 3
        : 4;

  return (
    <PipelineFlow
      initialStep={initialStep}
      autoRunRfps={autoRunRfps}
      onPipelineComplete={() => {
        setForceFlow(false);
        setAutoRunRfps(false);
        fetchStatus();
      }}
    />
  );
}

function PipelineFlow({
  initialStep,
  autoRunRfps,
  onPipelineComplete,
}: {
  initialStep: number;
  autoRunRfps: boolean;
  onPipelineComplete: () => void;
}) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [autoSendAfterDiscovery, setAutoSendAfterDiscovery] = useState(false);

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Stepper steps={steps} currentStep={currentStep} />

      <section className="flex flex-1 flex-col items-center px-6 py-12 sm:px-12">
        {currentStep === 1 && (
          <MenuIngestionStep onComplete={() => setCurrentStep(2)} />
        )}
        {currentStep === 2 && <PricingTrendsRunStep />}
        {currentStep === 3 && (
          <DistributorDiscoveryStep
            onSendInstantly={() => {
              setAutoSendAfterDiscovery(true);
              setCurrentStep(4);
            }}
          />
        )}
        {currentStep === 4 && (
          <RfpSendStep
            onComplete={onPipelineComplete}
            autoRun={autoRunRfps || autoSendAfterDiscovery}
          />
        )}
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

  const runParse = async () => {
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

      const r2 = await fetch("/api/menu-items");
      if (!r2.ok) throw new Error(`Could not load menu items (HTTP ${r2.status})`);
      const data = await r2.json();
      setItems(data.items as MenuItem[]);
      setPhase("details");
    } catch (err) {
      setProcessingError((err as Error).message || "Pipeline failed");
    }
  };

  const runExtract = async () => {
    setProcessingError(null);
    setPhase("processing");
    setStage("extract");
    try {
      const r = await fetch("/api/extract-recipe", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
      }
      onComplete();
    } catch (err) {
      setProcessingError((err as Error).message || "Pipeline failed");
    }
  };

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    runParse();
  };

  return (
    <>
      {phase === "url" && (
        <div className="flex flex-1 items-center">
          <UrlForm value={menuUrl} onChange={setMenuUrl} onSubmit={handleSubmitUrl} />
        </div>
      )}

      {phase === "details" && (
        <ItemsServingTable items={items} onSaved={runExtract} />
      )}

      {phase === "processing" && (
        <ProcessingModal
          stage={stage}
          error={processingError}
          onRetry={stage === "parse" ? runParse : runExtract}
          onCancel={() => {
            setPhase(stage === "extract" ? "details" : "url");
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
      description: "This usually takes 10–30 seconds.",
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

function SimpleLoadingModal({
  title,
  description,
  error,
  onRetry,
  onCancel,
}: {
  title: string;
  description: string;
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
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
                  Step failed
                </h2>
                <p className="mt-1 text-sm leading-6 text-zinc-600">
                  {title} did not complete.
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
          <div className="flex items-start gap-4">
            <Spinner className="mt-0.5 h-6 w-6 text-zinc-700" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-zinc-900">
                {title}…
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                {description}
              </p>
            </div>
          </div>
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
    const init: Record<
      number,
      { servings_per_day: string; serving_size: string }
    > = {};
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
          servings for each, these power downstream RFP requests.
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
                        placeholder="e.g. 8 Slices"
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
          30-day and 90-day trends. After this you&apos;ll discover
          distributors and send purchase RFPs.
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

function DistributorDiscoveryStep({
  onSendInstantly,
}: {
  onSendInstantly: () => void;
}) {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [sendInstantly, setSendInstantly] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await fetch(
        `/api/fetch-distributors?address=${encodeURIComponent(address.trim())}`,
      );
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
      }
      if (sendInstantly) {
        onSendInstantly();
      } else {
        router.push("/distributors");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to discover distributors");
      setRunning(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || running) return;
    handleRun();
  };

  return (
    <>
      <div className="flex flex-1 items-center">
        <div className="w-full max-w-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Find distributors near you
            </h1>
            <p className="mt-3 text-base text-zinc-600">
              We need your restaurant&apos;s location to discover the closest
              distributors that can supply your ingredients. After this
              you&apos;ll send purchase RFPs.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <label
              htmlFor="restaurant-address"
              className="text-sm font-medium text-zinc-700"
            >
              Restaurant address
            </label>
            <input
              id="restaurant-address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, Brooklyn, NY 11201"
              className="mt-2 block h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />

            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition hover:bg-zinc-100">
              <input
                type="checkbox"
                checked={sendInstantly}
                onChange={(e) => setSendInstantly(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-zinc-900">
                  Send RFP emails instantly
                </span>
                <span className="mt-0.5 text-xs text-zinc-500">
                  Skip the review step and email every matched distributor
                  as soon as discovery finishes.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={!address.trim() || running}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running && <Spinner className="h-4 w-4" />}
              {running ? "Discovering…" : "Start discovery"}
            </button>
          </form>
        </div>
      </div>

      {running && !error && (
        <SimpleLoadingModal
          title="Discovering distributors"
          description="This usually takes a few minutes."
          error={null}
          onRetry={handleRun}
          onCancel={() => setRunning(false)}
        />
      )}

      {error && (
        <SimpleLoadingModal
          title="Distributor discovery"
          description=""
          error={error}
          onRetry={() => {
            setError(null);
            handleRun();
          }}
          onCancel={() => setError(null)}
        />
      )}
    </>
  );
}

function RfpSendStep({
  onComplete,
  autoRun,
}: {
  onComplete: () => void;
  autoRun: boolean;
}) {
  const [senderEmail, setSenderEmail] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRunFiredRef = useRef(false);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const r = await fetch("/api/send-rfps", { method: "POST" });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.detail ?? body.error ?? `HTTP ${r.status}`);
      }
      onComplete();
    } catch (err) {
      setError((err as Error).message || "Failed to send RFPs");
      setRunning(false);
    }
  };

  useEffect(() => {
    if (autoRun && !autoRunFiredRef.current) {
      autoRunFiredRef.current = true;
      handleRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (running) return;
    handleRun();
  };

  return (
    <>
      <div className="flex flex-1 items-center">
        <div className="w-full max-w-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
              Send RFP emails
            </h1>
            <p className="mt-3 text-base text-zinc-600">
              Compose and send price-quote requests to every matched
              distributor, with the right ingredients and quantities for each.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
          >
            <label
              htmlFor="sender-email"
              className="text-sm font-medium text-zinc-700"
            >
              Sender email
            </label>
            <input
              id="sender-email"
              type="email"
              value={senderEmail}
              onChange={(e) => setSenderEmail(e.target.value)}
              placeholder="orders@your-restaurant.com"
              className="mt-2 block h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10"
            />
            <p className="mt-2 text-xs text-zinc-500">
              For decorative purposes only — RFPs are sent from a demo account
              for this MVP.
            </p>
            <button
              type="submit"
              disabled={running}
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running && <Spinner className="h-4 w-4" />}
              {running ? "Sending…" : "Send RFPs"}
            </button>
          </form>
        </div>
      </div>

      {running && !error && (
        <SimpleLoadingModal
          title="Sending RFP emails"
          description="Composing one email per matched distributor with quantities and deadlines, then sending via Gmail SMTP."
          error={null}
          onRetry={handleRun}
          onCancel={() => setRunning(false)}
        />
      )}

      {error && (
        <SimpleLoadingModal
          title="RFP send"
          description=""
          error={error}
          onRetry={() => {
            setError(null);
            handleRun();
          }}
          onCancel={() => setError(null)}
        />
      )}
    </>
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
            Pipeline complete
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Your menu, pricing trends, distributors, and RFPs are all
            populated. Re-running the pipeline will start a fresh ingestion
            from a new menu URL.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm text-zinc-700">
            <CountChip label="menu items" value={status.menu_items_count} />
            <CountChip
              label="pricing reports"
              value={status.pricing_trends_count}
            />
            <CountChip
              label="distributors"
              value={status.distributors_count}
            />
            <CountChip label="RFPs sent" value={status.rfp_requests_count} />
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

function CountChip({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1">
      <span className="font-semibold tabular-nums text-zinc-900">{value}</span>{" "}
      {label}
    </span>
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
                clear all existing data,
              </span>{" "}
              including menu items, recipes, ingredients, pricing trends, distributors,
              and RFPs. This cannot be undone.
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
}: {
  steps: { id: number; title: string; description: string }[];
  currentStep: number;
}) {
  return (
    <div className="border-b border-zinc-200 bg-white px-6 py-10 sm:px-12 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Pipeline
        </p>
        <h2 className="mb-8 text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
          Set up your platform
        </h2>

        <ol className="flex items-start">
          {steps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isComplete = step.id < currentStep;
            const isLast = idx === steps.length - 1;

            return (
              <Fragment key={step.id}>
                <li className="flex items-start gap-3">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold ${
                      isActive
                        ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                        : isComplete
                          ? "border-zinc-900 bg-white text-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-400"
                    }`}
                  >
                    {isComplete ? <CheckIcon className="h-5 w-5" /> : step.id}
                  </span>
                  <span className="flex flex-col pt-0.5">
                    <span
                      className={`text-sm font-semibold tracking-tight sm:text-base ${
                        isActive || isComplete
                          ? "text-zinc-900"
                          : "text-zinc-400"
                      }`}
                    >
                      {step.title}
                    </span>
                    <span className="mt-0.5 hidden text-xs text-zinc-500 sm:block">
                      {step.description}
                    </span>
                  </span>
                </li>
                {!isLast && (
                  <div
                    className={`mx-3 mt-6 h-0.5 flex-1 rounded-full ${
                      isComplete ? "bg-zinc-900" : "bg-zinc-200"
                    }`}
                  />
                )}
              </Fragment>
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
