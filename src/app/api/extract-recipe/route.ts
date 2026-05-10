import { NextResponse } from "next/server";
import { proxyMenuParser } from "@/lib/menuParser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    return await proxyMenuParser("POST", "/api/v1/extract-recipe");
  } catch (err) {
    console.error("POST /api/extract-recipe proxy failed", err);
    return NextResponse.json(
      { error: `Could not reach menu-parser service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
