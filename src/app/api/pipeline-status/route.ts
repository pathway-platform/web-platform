import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

async function tryCount(table: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ${table}`,
    );
    return rows[0]?.count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  try {
    const [menuItemsCount, pricingTrendsCount] = await Promise.all([
      tryCount("pathway.menu_item"),
      tryCount("pathway.pricing_trends"),
    ]);
    return NextResponse.json({
      menu_items_count: menuItemsCount,
      pricing_trends_count: pricingTrendsCount,
    });
  } catch (err) {
    console.error("GET /api/pipeline-status failed", err);
    return NextResponse.json(
      { error: "Failed to load pipeline status" },
      { status: 500 },
    );
  }
}
