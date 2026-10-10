import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/clients";
import type { ActivityItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from("bot_activity")
      .select("id,action,outcome,summary,deployment_id,created_at")
      .order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "Activity table is not ready. Run the supplied Supabase migration." }, { status: 503 });
    return NextResponse.json({ items: (data ?? []) as ActivityItem[] });
  } catch {
    return NextResponse.json({ error: "Supabase server configuration is incomplete." }, { status: 503 });
  }
}
