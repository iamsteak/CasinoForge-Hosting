import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse, sameOrigin } from "@/lib/http";
import { railwayGraphQL, railwayTarget } from "@/lib/railway";
import { createSupabaseAdmin } from "@/lib/supabase/clients";

export const dynamic = "force-dynamic";

type Action = "deploy" | "restart" | "stop" | "rollback";
const DEPLOY = `mutation DeployWorker($input: EnvironmentTriggersDeployInput!) { environmentTriggersDeploy(input: $input) }`;
const RESTART = `mutation RestartWorker($id: String!) { deploymentRestart(id: $id) }`;
const STOP = `mutation StopWorker($id: String!) { deploymentStop(id: $id) }`;
const ROLLBACK = `mutation RollbackWorker($id: String!) { deploymentRollback(id: $id) { id status } }`;
const LATEST = `query LatestDeployment($input: DeploymentListInput!, $first: Int!) { deployments(input: $input, first: $first) { edges { node { id status } } } }`;

async function audit(action: Action, outcome: "requested" | "succeeded" | "failed", summary: string, deploymentId?: string) {
  try {
    const admin = createSupabaseAdmin();
    await admin.from("bot_activity").insert({ action, outcome, summary, deployment_id: deploymentId ?? null });
  } catch {
    // Operational controls should not fail solely because the audit database is temporarily unavailable.
  }
}

export async function POST(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  let body: { action?: unknown; deploymentId?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const action = body.action;
  if (!(action === "deploy" || action === "restart" || action === "stop" || action === "rollback")) {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }
  const actionName = action as Action;
  const { projectId, serviceId, environmentId } = railwayTarget();

  try {
    if (actionName === "deploy") {
      await audit(actionName, "requested", "Queued a deploy of the configured Railway service.");
      await railwayGraphQL(DEPLOY, { input: { projectId, serviceId, environmentId } });
      await audit(actionName, "succeeded", "Railway accepted a service deployment request.");
      return NextResponse.json({ ok: true, message: "Railway accepted the deploy request." });
    }

    let deploymentId = typeof body.deploymentId === "string" ? body.deploymentId : "";
    if (!deploymentId && (actionName === "restart" || actionName === "stop")) {
      const latest = await railwayGraphQL<{ deployments: { edges: Array<{ node: { id: string; status: string } }> } }>(LATEST, {
        input: { projectId, serviceId, environmentId }, first: 1,
      });
      deploymentId = latest.deployments.edges[0]?.node.id ?? "";
    }
    if (!deploymentId || deploymentId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(deploymentId)) {
      return NextResponse.json({ error: "A valid active or historical deployment ID is required." }, { status: 400 });
    }

    await audit(actionName, "requested", `${actionName} requested for a Railway deployment.`, deploymentId);
    if (actionName === "restart") await railwayGraphQL(RESTART, { id: deploymentId });
    if (actionName === "stop") await railwayGraphQL(STOP, { id: deploymentId });
    if (actionName === "rollback") await railwayGraphQL(ROLLBACK, { id: deploymentId });
    await audit(actionName, "succeeded", `Railway accepted the ${actionName} request.`, deploymentId);
    return NextResponse.json({ ok: true, message: `Railway accepted the ${actionName} request.` });
  } catch (error) {
    await audit(actionName, "failed", `Railway did not accept the ${actionName} request.`);
    return errorResponse(error);
  }
}
