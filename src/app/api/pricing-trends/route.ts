import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT
         pt.id,
         pt.report_id,
         pt.commodity_filter,
         pt.ingredients_covered,
         pt.status,
         pt.price_value,
         pt.price_unit,
         pt.price_as_of,
         pt.trend_label,
         pt.change_30d_pct,
         pt.change_90d_pct,
         pt.sparkline,
         pt.data_points,
         pt.source,
         pt.error,
         pt.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id',             i.id,
               'canonical_name', i.canonical_name,
               'category',       i.category,
               'unit',           i.unit
             ) ORDER BY i.canonical_name
           ) FILTER (WHERE i.id IS NOT NULL),
           '[]'::json
         ) AS ingredients
       FROM pathway.pricing_trends pt
       LEFT JOIN LATERAL (
         SELECT trim(t)::bigint AS id
         FROM unnest(string_to_array(NULLIF(pt.ingredients_covered, ''), ',')) AS t
         WHERE trim(t) ~ '^\\d+$'
       ) AS covered ON true
       LEFT JOIN pathway.ingredients i ON i.id = covered.id
       GROUP BY pt.id
       ORDER BY pt.commodity_filter, pt.created_at DESC`,
    );
    return NextResponse.json({ trends: rows });
  } catch (err) {
    console.error("GET /api/pricing-trends failed", err);
    return NextResponse.json(
      { error: "Failed to load pricing trends" },
      { status: 500 },
    );
  }
}
