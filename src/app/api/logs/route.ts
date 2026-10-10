import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { railwayGraphQL, railwayTarget } from "@/lib/railway";
import type { RuntimeLog } from "@/lib/types";

export const dynamic = "force-dynamic";
const LATEST = `query LatestDeployment($input: DeploymentListInput!, $first: Int!) { deployments(input: $input, first: $first) { edges { node { id } } } }`;
const LOGS = `query DeploymentRuntimeLogs($deploymentId: String!, $limit: Int) { deploymentLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message severity } }`;

export async function GET(request: NextRequest) {
  const owner = await requireOwner();
  if (!owner.ok) return NextResponse.json({ error: owner.message }, { status: owner.status });
  try {
    const target = railwayTarget();
    let deploymentId = request.nextUrl.searchParams.get("deploymentId") ?? "";
    if (deploymentId && (deploymentId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(deploymentId))) {
      return NextResponse.json({ error: "Invalid deployment ID." }, { status: 400 });
    }
    if (!deploymentId) {
      const latest = await railwayGraphQL<{ deployments: { edges: Array<{ node: { id: string } }> } }>(LATEST, {
        input: target, first: 1,
      });
      deploymentId = latest.deployments.edges[0]?.node.id ?? "";
    }
    if (!deploymentId) return NextResponse.json({ deploymentId: null, logs: [] });
    const data = await railwayGraphQL<{ deploymentLogs: RuntimeLog[] }>(LOGS, { deploymentId, limit: 200 });
    return NextResponse.json({ deploymentId, logs: data.deploymentLogs ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
