import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { runAdsJob } from "@/lib/jobs/handlers/ads";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "ads")) {
    return NextResponse.json({ error: upgradeMessage("ads") }, { status: 403 });
  }

  const result = await runAdsJob(businessId);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
