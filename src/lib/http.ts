import { NextResponse, type NextRequest } from "next/server";
import { RailwayError } from "@/lib/railway";

export function errorResponse(error: unknown) {
  if (error instanceof RailwayError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: "The request could not be completed." }, { status: 500 });
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
