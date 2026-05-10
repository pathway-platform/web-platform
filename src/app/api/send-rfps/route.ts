import { NextResponse } from "next/server";
import { proxyDistributorHandler } from "@/lib/distributorHandler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return await proxyDistributorHandler("POST", "/send-rfps", {});
  } catch (err) {
    console.error("POST /api/send-rfps proxy failed", err);
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
