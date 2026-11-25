import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Exposes the running server's build id so open tabs can detect deployments without reloading. */
export function GET() {
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
