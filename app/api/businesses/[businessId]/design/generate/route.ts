import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { runSiteDesignJob } from "@/lib/jobs/handlers/site-design";

// Two AI images can take a while.
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const result = await runSiteDesignJob(businessId);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
