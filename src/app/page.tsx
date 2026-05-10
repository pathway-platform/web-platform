"use client";

import { useState } from "react";

const steps = [
  { id: 1, title: "Menu Ingestion", description: "Import items from a menu URL." },
  { id: 2, title: "Pricing Trends", description: "Track and analyze pricing." },
];

export default function Home() {
  const [currentStep, setCurrentStep] = useState(1);
  const [menuUrl, setMenuUrl] = useState("");

  const handleIngest = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentStep(2);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Stepper
        steps={steps}
        currentStep={currentStep}
        onSelect={setCurrentStep}
      />

      <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        {currentStep === 1 && (
          <MenuIngestionStep
            value={menuUrl}
            onChange={setMenuUrl}
            onSubmit={handleIngest}
          />
        )}
        {currentStep === 2 && <PricingTrendsStep />}
      </section>
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
    <div className="border-b border-zinc-200 bg-white px-6 py-6 sm:px-12">
      <ol className="mx-auto flex max-w-4xl items-center gap-4">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isComplete = step.id < currentStep;
          const isLast = idx === steps.length - 1;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-4">
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                className="group flex items-center gap-3 text-left"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                    isActive
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : isComplete
                        ? "border-zinc-900 bg-white text-zinc-900"
                        : "border-zinc-300 bg-white text-zinc-400 group-hover:border-zinc-400"
                  }`}
                >
                  {isComplete ? <CheckIcon className="h-4 w-4" /> : step.id}
                </span>
                <span className="flex flex-col">
                  <span
                    className={`text-sm font-semibold tracking-tight ${
                      isActive
                        ? "text-zinc-900"
                        : isComplete
                          ? "text-zinc-900"
                          : "text-zinc-400"
                    }`}
                  >
                    {step.title}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {step.description}
                  </span>
                </span>
              </button>

              {!isLast && (
                <div
                  className={`h-px flex-1 ${
                    isComplete ? "bg-zinc-900" : "bg-zinc-200"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function MenuIngestionStep({
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
        <label
          htmlFor="menu-url"
          className="text-sm font-medium text-zinc-700"
        >
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

function PricingTrendsStep() {
  return (
    <div className="w-full max-w-xl text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Pricing Trends
      </h1>
      <p className="mt-3 text-base text-zinc-600">
        This step is coming soon.
      </p>
    </div>
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
