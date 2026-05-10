import { NextResponse } from "next/server";
import { proxyMenuParser } from "@/lib/menuParser";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = body?.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    return await proxyMenuParser("POST", "/api/v1/parse-menu-url", { url });
  } catch (err) {
    console.error("POST /api/parse-menu-url proxy failed", err);
    return NextResponse.json(
      { error: `Could not reach menu-parser service: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
