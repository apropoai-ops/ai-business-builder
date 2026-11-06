import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getUser } from "@/lib/auth/user";
import { runContentJob } from "@/lib/jobs/handlers/content";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

const bodySchema = z.object({ topic: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "נושא נדרש" }, { status: 400 });
  }

  const { businessId } = await params;

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "content_engine")) {
    return NextResponse.json({ error: upgradeMessage("content_engine") }, { status: 403 });
  }

  const result = await runContentJob(businessId, parsed.data.topic);

  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
