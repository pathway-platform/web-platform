import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [distributorsRes, ingredientsRes, rfpTotalRes] = await Promise.all([
      pool.query(
        `SELECT
           d.id,
           d.place_id,
           d.name,
           d.address,
           d.phone,
           d.email,
           d.website,
           d.lat,
           d.lng,
           d.rating,
           d.review_count,
           d.business_status,
           d.verification_method,
           d.discovery_source,
           d.categories::jsonb        AS categories,
           d.verified_categories::jsonb AS verified_categories,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', i.id,
                 'canonical_name', i.canonical_name,
                 'category', i.category,
                 'unit', i.unit,
                 'confidence', di.confidence
               ) ORDER BY i.canonical_name
             ) FILTER (WHERE i.id IS NOT NULL),
             '[]'::json
           ) AS linked_ingredients,
           (
             SELECT COUNT(*)::int
             FROM pathway.rfp_requests r
             WHERE r.distributor_id = d.id
           ) AS rfp_count
         FROM pathway.distributors d
         LEFT JOIN pathway.distributor_ingredient di ON di.distributor_id = d.id
         LEFT JOIN pathway.ingredients i ON i.id = di.ingredient_id
         GROUP BY d.id
         ORDER BY d.name`,
      ),
      pool.query(
        `SELECT id, canonical_name, category, unit
         FROM pathway.ingredients
         ORDER BY canonical_name`,
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM pathway.rfp_requests`),
    ]);

    return NextResponse.json({
      distributors: distributorsRes.rows,
      ingredients: ingredientsRes.rows,
      rfp_requests_count: rfpTotalRes.rows[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("GET /api/distributors failed", err);
    return NextResponse.json(
      { error: "Failed to load distributors" },
      { status: 500 },
    );
  }
}
