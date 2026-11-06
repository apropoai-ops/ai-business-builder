import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { runBrandingJob } from "@/lib/jobs/handlers/branding";

export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const result = await runBrandingJob(businessId);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
