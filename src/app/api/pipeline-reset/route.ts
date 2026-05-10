import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await pool.query(
      `TRUNCATE
         pathway.rfp_line_items,
         pathway.rfp_requests,
         pathway.distributor_ingredient,
         pathway.distributors,
         pathway.recipe_ingredients,
         pathway.recipe,
         pathway.ingredients,
         pathway.pricing_trends,
         pathway.menu_item
       RESTART IDENTITY CASCADE`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/pipeline-reset failed", err);
    return NextResponse.json(
      { error: "Failed to reset pipeline" },
      { status: 500 },
    );
  }
}
