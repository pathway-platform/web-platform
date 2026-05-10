import Link from "next/link";

export default function EmptyState({
  message = "No data present. Run the complete ETL pipeline for data to show up here.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-zinc-500"
            aria-hidden="true"
          >
            <path d="M3 7.5 12 3l9 4.5" />
            <path d="M3 7.5v9L12 21l9-4.5v-9" />
            <path d="m3 7.5 9 4.5 9-4.5" />
            <path d="M12 12v9" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
          No data yet
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{message}</p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-zinc-900 px-5 text-sm font-medium text-white transition hover:bg-zinc-800"
        >
          Run the pipeline
        </Link>
      </div>
    </div>
  );
}
