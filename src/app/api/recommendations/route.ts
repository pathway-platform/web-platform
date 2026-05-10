import { NextResponse } from "next/server";
import { proxyDistributorHandler } from "@/lib/distributorHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const qs = incoming.search;
  try {
    return await proxyDistributorHandler("GET", `/recommendations${qs}`);
  } catch (err) {
    console.error("GET /api/recommendations proxy failed", err);
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
