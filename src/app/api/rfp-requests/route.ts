import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT
         r.id,
         r.distributor_id,
         d.name              AS distributor_name,
         d.address           AS distributor_address,
         d.email             AS distributor_email,
         d.phone             AS distributor_phone,
         d.website           AS distributor_website,
         d.categories::jsonb AS distributor_categories,
         r.recipient_email,
         r.used_fallback_email,
         r.sent_at,
         r.deadline_at,
         r.status,
         r.subject,
         r.body,
         r.message_id,
         COALESCE(
           json_agg(
             json_build_object(
               'id', li.id,
               'ingredient_id', li.ingredient_id,
               'ingredient_name', i.canonical_name,
               'category', i.category,
               'quantity', li.quantity,
               'unit', li.unit,
               'window_days', li.window_days,
               'is_upsell', li.is_upsell
             ) ORDER BY li.is_upsell, i.canonical_name
           ) FILTER (WHERE li.id IS NOT NULL),
           '[]'::json
         ) AS line_items
       FROM pathway.rfp_requests r
       JOIN pathway.distributors d ON d.id = r.distributor_id
       LEFT JOIN pathway.rfp_line_items li ON li.rfp_id = r.id
       LEFT JOIN pathway.ingredients i ON i.id = li.ingredient_id
       GROUP BY r.id, d.id
       ORDER BY r.sent_at DESC`,
    );

    return NextResponse.json({ rfps: rows });
  } catch (err) {
    console.error("GET /api/rfp-requests failed", err);
    return NextResponse.json(
      { error: "Failed to load RFP requests" },
      { status: 500 },
    );
  }
}
