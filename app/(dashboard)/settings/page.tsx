import { Settings } from "lucide-react";

import { requireUser } from "@/lib/auth/user";
import { createClient } from "@/lib/supabase/server";
import { getPlanForUser, getMonthlyUsage } from "@/lib/quota";
import { AccountSettings } from "@/components/auth/account-settings";
import { SubscriptionCard } from "@/components/billing/subscription-card";

export const metadata = { title: "הגדרות חשבון" };

export default async function SettingsPage() {
  const { user, profile } = await requireUser();

  const supabase = await createClient();
  const [plan, usage, { data: subscription }] = await Promise.all([
    getPlanForUser(user.id),
    getMonthlyUsage(user.id),
    supabase
      .from("subscriptions").select("stripe_customer_id")
      .eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">הגדרות חשבון</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {user.email}
          </p>
        </div>
      </div>

      <SubscriptionCard
        planName={plan.name}
        isPaid={plan.tier !== "free"}
        hasStripeCustomer={Boolean(subscription?.stripe_customer_id)}
        usage={[
          { label: "יצירות AI החודש", used: usage.aiGenerations, limit: plan.aiGenerations },
          { label: "הודעות צ'אט החודש", used: usage.chatMessages, limit: plan.chatMessages },
          { label: "עלות AI החודש (לעסק)", used: usage.aiCostUsd, limit: plan.monthlyCostCapUsd, prefix: "$" },
          { label: "עסקים", used: usage.businesses, limit: plan.businesses },
        ]}
      />

      <AccountSettings fullName={profile?.full_name ?? ""} />
    </div>
  );
}
