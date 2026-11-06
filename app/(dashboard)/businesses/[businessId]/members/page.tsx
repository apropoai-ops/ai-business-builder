import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { requireUser } from "@/lib/auth/user";
import { getBusiness } from "@/lib/services/business.service";
import { getMemberRole, listMembers } from "@/lib/services/members.service";
import { MembersManager } from "@/components/business/members-manager";

export const metadata = { title: "חברי צוות" };

export default async function MembersPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const { user } = await requireUser();
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const role = await getMemberRole(businessId, user.id);
  if (role !== "owner" && role !== "admin") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-6" />
          </div>
          <h1 className="text-lg font-semibold">אין לך הרשאה לצפות בעמוד זה</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ניהול חברי צוות זמין רק לבעל/ת העסק ולמנהלים
          </p>
        </div>
      </div>
    );
  }

  const { members, invites } = await listMembers(businessId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Users className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">חברי צוות</h1>
          <p className="text-sm text-muted-foreground">
            הזמינו אנשי צוות לניהול משותף של העסק, וקבעו לכל אחד את רמת ההרשאה
          </p>
        </div>
      </div>

      <MembersManager
        businessId={businessId}
        currentRole={role}
        initialMembers={members}
        initialInvites={invites}
      />
    </div>
  );
}
