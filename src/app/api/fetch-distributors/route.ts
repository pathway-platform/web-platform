import { NextResponse } from "next/server";
import { proxyDistributorHandler } from "@/lib/distributorHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const address = incoming.searchParams.get("address")?.trim();
  if (!address) {
    return NextResponse.json(
      { error: "address query param is required" },
      { status: 400 },
    );
  }

  try {
    return await proxyDistributorHandler(
      "GET",
      `/fetch-distributors?address=${encodeURIComponent(address)}`,
    );
  } catch (err) {
    console.error("GET /api/fetch-distributors proxy failed", err);
    return NextResponse.json(
      {
        error: `Could not reach distributor-handler service: ${
          (err as Error).message
        }`,
      },
      { status: 502 },
    );
  }
}
