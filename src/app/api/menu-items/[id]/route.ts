import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = Number(id);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `SELECT
         m.id,
         m.item_name,
         m.item_desc,
         m.price,
         m.servings_per_day,
         m.serving_size,
         r.recipe_steps,
         r.prep_time_minutes,
         r.cook_time_minutes,
         COALESCE(
           json_agg(
             json_build_object(
               'id',             i.id,
               'canonical_name', i.canonical_name,
               'category',       i.category,
               'unit',            i.unit,
               'daily_quantity', ri.daily_quantity
             ) ORDER BY i.canonical_name
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'::json
         ) AS ingredients
       FROM pathway.menu_item m
       LEFT JOIN pathway.recipe r              ON r.menu_item_id = m.id
       LEFT JOIN pathway.recipe_ingredients ri ON ri.menu_item_id = m.id
       LEFT JOIN pathway.ingredients i         ON i.id = ri.ingredient_id
       WHERE m.id = $1
       GROUP BY m.id, r.recipe_steps, r.prep_time_minutes, r.cook_time_minutes`,
      [numericId],
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    console.error(`GET /api/menu-items/${numericId} failed`, err);
    return NextResponse.json(
      { error: "Failed to load menu item" },
      { status: 500 },
    );
  }
}
