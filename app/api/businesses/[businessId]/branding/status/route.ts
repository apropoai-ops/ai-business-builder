import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBrandAssets } from "@/lib/services/branding.service";
import { getLatestJob } from "@/lib/services/job.service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const assets = await getBrandAssets(businessId);
  const job = await getLatestJob(businessId, "branding");

  return NextResponse.json({
    ready: Boolean(assets?.generated_at),
    job: job ? { id: job.id, status: job.status, error: job.error } : null,
  });
}
