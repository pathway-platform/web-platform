import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT id, item_name, item_desc, price, servings_per_day, serving_size
         FROM pathway.menu_item
         ORDER BY item_name`,
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("GET /api/menu-items failed", err);
    return NextResponse.json(
      { error: "Failed to load menu items" },
      { status: 500 },
    );
  }
}

type UpdateItem = {
  id: number;
  servings_per_day: number;
  serving_size: string | null;
};

export async function PATCH(req: Request) {
  let body: { items?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json(
      { error: "items array is required" },
      { status: 400 },
    );
  }

  const updates: UpdateItem[] = [];
  for (const raw of body.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const spdRaw = r.servings_per_day;
    const spd =
      spdRaw === undefined || spdRaw === null || spdRaw === ""
        ? 1
        : Number(spdRaw);
    if (!Number.isFinite(spd) || spd < 0) continue;
    const sizeRaw = r.serving_size;
    const serving_size =
      typeof sizeRaw === "string" && sizeRaw.trim() !== ""
        ? sizeRaw.trim()
        : null;
    updates.push({
      id,
      servings_per_day: Math.floor(spd),
      serving_size,
    });
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 });
  }

  try {
    await pool.query(
      `UPDATE pathway.menu_item m
         SET servings_per_day = data.spd,
             serving_size     = data.sz
         FROM (
           SELECT * FROM unnest($1::bigint[], $2::int[], $3::text[])
           AS t(id, spd, sz)
         ) data
         WHERE m.id = data.id`,
      [
        updates.map((u) => u.id),
        updates.map((u) => u.servings_per_day),
        updates.map((u) => u.serving_size),
      ],
    );
    return NextResponse.json({ ok: true, updated: updates.length });
  } catch (err) {
    console.error("PATCH /api/menu-items failed", err);
    return NextResponse.json(
      { error: "Failed to update menu items" },
      { status: 500 },
    );
  }
}
