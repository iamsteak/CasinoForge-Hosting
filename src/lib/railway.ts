const RAILWAY_ENDPOINT = "https://backboard.railway.com/graphql/v2";

export class RailwayError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
    this.name = "RailwayError";
  }
}

export function railwayConfig() {
  const required = {
    RAILWAY_API_TOKEN: process.env.RAILWAY_API_TOKEN,
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID,
    RAILWAY_SERVICE_ID: process.env.RAILWAY_SERVICE_ID,
    RAILWAY_ENVIRONMENT_ID: process.env.RAILWAY_ENVIRONMENT_ID,
  };
  const missing = Object.entries(required)
    .filter(([, value]) => !value?.trim())
    .map(([name]) => name);
  return { configured: missing.length === 0, missing, values: required };
}

export async function railwayGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN;
  if (!token) throw new RailwayError("Railway is not configured.", 503);

  let response: Response;
  try {
    response = await fetch(RAILWAY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RailwayError("Could not reach Railway. Try again in a moment.");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new RailwayError("Railway rejected the configured token. Check its scope and value.", 502);
    }
    throw new RailwayError("Railway returned an error while handling the request.");
  }

  const payload = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (payload.errors?.length || !payload.data) {
    // Do not return provider error details; they may include configuration values.
    throw new RailwayError("Railway could not complete this operation. Check service and environment IDs.");
  }
  return payload.data;
}

export function railwayTarget() {
  const config = railwayConfig();
  if (!config.configured) throw new RailwayError("Railway service IDs and token are not fully configured.", 503);
  return {
    projectId: config.values.RAILWAY_PROJECT_ID!,
    serviceId: config.values.RAILWAY_SERVICE_ID!,
    environmentId: config.values.RAILWAY_ENVIRONMENT_ID!,
  };
}
