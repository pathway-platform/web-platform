import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT
         i.id,
         i.canonical_name,
         i.category,
         i.unit,
         i.daily_total_quantity,
         i.used_in,
         COALESCE(
           json_agg(
             json_build_object('id', m.id, 'name', m.item_name)
             ORDER BY m.item_name
           ) FILTER (WHERE m.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM pathway.ingredients i
       LEFT JOIN LATERAL (
         SELECT trim(t)::bigint AS id
         FROM unnest(string_to_array(NULLIF(i.used_in, ''), ',')) AS t
         WHERE trim(t) ~ '^\\d+$'
       ) AS used ON true
       LEFT JOIN pathway.menu_item m ON m.id = used.id
       GROUP BY i.id
       ORDER BY i.canonical_name`,
    );
    return NextResponse.json({ ingredients: rows });
  } catch (err) {
    console.error("GET /api/ingredients failed", err);
    return NextResponse.json(
      { error: "Failed to load ingredients" },
      { status: 500 },
    );
  }
}
