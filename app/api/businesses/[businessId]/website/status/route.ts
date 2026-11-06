import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/user";
import { getWebsite } from "@/lib/services/website.service";
import { getLatestJob } from "@/lib/services/job.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  const website = await getWebsite(businessId);
  const job = await getLatestJob(businessId, "website");

  return NextResponse.json({
    ready: Boolean(website?.generated_at),
    job: job ? { id: job.id, status: job.status, error: job.error } : null,
  });
}
