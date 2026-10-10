import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse, sameOrigin } from "@/lib/http";
import { railwayGraphQL, railwayTarget } from "@/lib/railway";
import { createSupabaseAdmin } from "@/lib/supabase/clients";

export const dynamic = "force-dynamic";
const VARIABLE_QUERY = `query ServiceVariables($projectId: String!, $environmentId: String!, $serviceId: String) { variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) }`;
const UPSERT = `mutation UpdateServiceVariable($input: VariableUpsertInput!) { variableUpsert(input: $input) }`;
const DELETE_VARIABLE = `mutation DeleteServiceVariable($input: VariableDeleteInput!) { variableDelete(input: $input) }`;
const NAME = /^[A-Z][A-Z0-9_]{0,127}$/;

type VarsResult = { variables: Record<string, string> | null };

async function record(action: "variable_upsert" | "variable_delete", summary: string) {
  try {
    const admin = createSupabaseAdmin();
    await admin.from("bot_activity").insert({ action, outcome: "succeeded", summary });
  } catch {
    // Secret updates must not be rolled back because audit storage is unavailable.
  }
}

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  try {
    const target = railwayTarget();
    const data = await railwayGraphQL<VarsResult>(VARIABLE_QUERY, target);
    return NextResponse.json({ names: Object.keys(data.variables ?? {}).sort() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  let body: { name?: unknown; value?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const value = typeof body.value === "string" ? body.value : "";
  if (!NAME.test(name)) return NextResponse.json({ error: "Use an uppercase key such as DISCORD_TOKEN or NODE_ENV." }, { status: 400 });
  if (!value || value.length > 8192) return NextResponse.json({ error: "Provide a value no longer than 8,192 characters." }, { status: 400 });

  try {
    const target = railwayTarget();
    await railwayGraphQL(UPSERT, { input: { ...target, name, value, skipDeploys: true } });
    await record("variable_upsert", `Saved Railway variable ${name}; deploy is still manual.`);
    return NextResponse.json({ ok: true, name, message: `${name} saved in Railway. Deploy the worker to apply it.` });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  let body: { name?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!NAME.test(name)) return NextResponse.json({ error: "Invalid variable name." }, { status: 400 });

  try {
    const target = railwayTarget();
    await railwayGraphQL(DELETE_VARIABLE, { input: { ...target, name } });
    await record("variable_delete", `Deleted Railway variable ${name}.`);
    return NextResponse.json({ ok: true, name, message: `${name} deleted from Railway.` });
  } catch (error) {
    return errorResponse(error);
  }
}
