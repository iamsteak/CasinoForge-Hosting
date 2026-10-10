import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { railwayConfig, railwayGraphQL } from "@/lib/railway";
import { createSupabaseAdmin } from "@/lib/supabase/clients";
import type { ActivityItem, Deployment } from "@/lib/types";

export const dynamic = "force-dynamic";

const DASHBOARD_QUERY = `query BotdockOverview($projectId: String!, $serviceId: String!, $environmentId: String!, $first: Int!) {
  project(id: $projectId) { name }
  deployments(input: { projectId: $projectId, serviceId: $serviceId, environmentId: $environmentId }, first: $first) {
    edges { node { id status createdAt url canRollback canRedeploy } }
  }
  variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
}`;

type DashboardResponse = {
  project: { name: string } | null;
  deployments: { edges: Array<{ node: Deployment }> };
  variables: Record<string, string> | null;
};

export async function GET() {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });

  const railway = railwayConfig();
  let activity: ActivityItem[] = [];
  let activityReady = false;
  const hasDbSecret = Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (hasDbSecret) {
    try {
      const admin = createSupabaseAdmin();
      const result = await admin.from("bot_activity").select("id,action,outcome,summary,deployment_id,created_at").order("created_at", { ascending: false }).limit(12);
      if (!result.error) { activity = (result.data ?? []) as ActivityItem[]; activityReady = true; }
    } catch {
      // The dashboard remains useful while optional activity storage is being configured.
    }
  }

  const missing = [...railway.missing];
  if (!hasDbSecret) missing.push("SUPABASE_SECRET_KEY");
  else if (!activityReady) missing.push("SUPABASE_ACTIVITY_MIGRATION");
  if (!railway.configured) {
    return NextResponse.json({ connected: false, activityReady, missing, project: null, deployments: [], variableNames: [], activity });
  }

  try {
    const { RAILWAY_PROJECT_ID, RAILWAY_SERVICE_ID, RAILWAY_ENVIRONMENT_ID } = railway.values;
    const data = await railwayGraphQL<DashboardResponse>(DASHBOARD_QUERY, {
      projectId: RAILWAY_PROJECT_ID,
      serviceId: RAILWAY_SERVICE_ID,
      environmentId: RAILWAY_ENVIRONMENT_ID,
      first: 25,
    });
    const deployments = (data.deployments?.edges ?? []).map(({ node }) => ({
      id: node.id,
      status: node.status,
      createdAt: node.createdAt,
      url: node.url ?? null,
      canRollback: Boolean(node.canRollback),
      canRedeploy: Boolean(node.canRedeploy),
    }));
    return NextResponse.json({
      connected: true,
      activityReady,
      missing,
      project: data.project?.name ?? "Railway service",
      deployments,
      variableNames: Object.keys(data.variables ?? {}).sort(),
      activity,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
