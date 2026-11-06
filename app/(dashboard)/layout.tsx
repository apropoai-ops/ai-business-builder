import Link from "next/link";
import { Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "@/components/shared/user-menu";
import { CustomerAccountGate } from "@/components/shared/customer-account-gate";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile } = await requireUser();

  // STORE-CUSTOMER accounts (signed up via a business's storefront) don't
  // belong in the platform dashboard — unless they actually own a business OR
  // are an active team member of one. No explicit membership query needed:
  // RLS (businesses_all_own + businesses_select_member, see
  // 0067_business_members.sql) already scopes this count to owned-or-member
  // businesses, so it "just works" once that migration is applied.
  let gated = false;
  if (user.user_metadata?.is_customer === true) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true });
    gated = (count ?? 0) === 0;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/businesses" className="flex items-center gap-2 font-bold">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-5" />
            </div>
            <span className="hidden sm:inline">AI Business Builder</span>
          </Link>
          <UserMenu
            email={user.email ?? ""}
            fullName={profile?.full_name ?? null}
          />
        </div>
      </header>
      <main className="flex-1">
        {gated ? <CustomerAccountGate userId={user.id} /> : children}
      </main>
    </div>
  );
}
