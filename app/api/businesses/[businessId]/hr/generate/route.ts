import { NextResponse, type NextRequest } from "next/server";

import { getUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { createHrRole } from "@/lib/services/hr.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows, upgradeMessage } from "@/lib/entitlements";

export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { businessId } = await params;
  if (!(await getBusiness(businessId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "hr")) {
    return NextResponse.json({ error: upgradeMessage("hr") }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const role = String(body?.role ?? "").trim();
  const details = String(body?.details ?? "").trim();
  if (role.length < 2) {
    return NextResponse.json({ error: "נא להזין שם תפקיד" }, { status: 400 });
  }

  try {
    const created = await createHrRole(businessId, role, details || undefined);
    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "יצירת חבילת הגיוס נכשלה" },
      { status: 500 },
    );
  }
}
