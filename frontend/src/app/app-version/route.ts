import { connection, NextResponse } from "next/server";

/** Exposes the running server's build id so open tabs can detect deployments without reloading. */
export async function GET() {
  await connection();
  return NextResponse.json(
    { buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
