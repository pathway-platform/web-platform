import { NextResponse } from "next/server";
import { proxyMenuParser } from "@/lib/menuParser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  try {
    return await proxyMenuParser("GET", "/api/v1/pricing-trends");
  } catch (err) {
    console.error("GET /api/run-pricing-trends proxy failed", err);
    return NextResponse.json(
      { error: `Could not reach menu-parser service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
