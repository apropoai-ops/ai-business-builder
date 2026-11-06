import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { runContentCalendarJob } from "@/lib/jobs/handlers/content-calendar";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

const bodySchema = z.object({ period: z.enum(["week", "month", "quarter"]) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "תקופה לא תקינה" }, { status: 400 });
  }

  const { businessId } = await params;

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "content_calendar")) {
    return NextResponse.json({ error: upgradeMessage("content_calendar") }, { status: 403 });
  }

  const result = await runContentCalendarJob(businessId, parsed.data.period);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
