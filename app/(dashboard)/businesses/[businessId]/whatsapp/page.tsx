import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Settings2, Plug, Inbox, BookOpen } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import {
  getWhatsappConfig,
  getWhatsappConversations,
  getMessagesByConversation,
} from "@/lib/services/whatsapp.service";
import { getLatestJob } from "@/lib/services/job.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsappView } from "@/components/business/whatsapp-view";
import { WhatsappConnection } from "@/components/business/whatsapp-connection";
import { WhatsappConversations } from "@/components/business/whatsapp-conversations";
import { WhatsappFollowUps } from "@/components/business/whatsapp-follow-ups";
import { Badge } from "@/components/ui/badge";
import { UpgradeGate } from "@/components/billing/upgrade-gate";

export const metadata = { title: "סוכן וואטסאפ" };

export default async function WhatsappPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "whatsapp_agent")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="whatsapp_agent" />
      </div>
    );
  }

  const [config, latestJob, conversations] = await Promise.all([
    getWhatsappConfig(businessId),
    getLatestJob(businessId, "whatsapp"),
    getWhatsappConversations(businessId),
  ]);
  // The inbox tab shows every loaded conversation (not just the open ones),
  // so it needs a message per conversation id here, unlike the CRM follow-up
  // queue which only needs the open subset.
  const messagesByConversation = await getMessagesByConversation(
    businessId,
    conversations.map((c) => c.id),
  );

  // Never ship the Meta credentials to the browser — the form only needs to
  // know whether each one is already saved.
  const safeConfig = config ? { ...config, access_token: null, app_secret: null } : null;

  const isGenerating = latestJob?.status === "running";
  const pendingReplies = conversations.filter((c) => c.needs_reply).length;

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const webhookUrl = `${appUrl}/api/whatsapp/webhook`;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? "(הגדירו WHATSAPP_VERIFY_TOKEN ב-env)";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">סוכן וואטסאפ חכם</h1>
          <p className="text-sm text-muted-foreground">
            סוכן AI שמטפל בלידים, הזמנות, שאלות נפוצות ומכירות
          </p>
        </div>
        {/* Reachable from every tab, not just the connection one — an owner who
            gets stuck is usually looking at the simulator wondering why the
            real thing is silent. */}
        <Link
          href="/guides/whatsapp"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
        >
          <BookOpen className="size-3.5" />
          מדריך חיבור
        </Link>
      </div>

      <Tabs defaultValue="agent" dir="rtl">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="agent" className="gap-1.5">
            <Settings2 className="size-3.5" />
            סוכן וסימולטור
          </TabsTrigger>
          <TabsTrigger value="connect" className="gap-1.5">
            <Plug className="size-3.5" />
            חיבור אמיתי
          </TabsTrigger>
          <TabsTrigger value="inbox" className="gap-1.5">
            <Inbox className="size-3.5" />
            שיחות
            {pendingReplies > 0 && (
              <Badge className="h-4 min-w-4 bg-red-600 px-1 text-[10px]">{pendingReplies}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agent" className="mt-4">
          <WhatsappView
            key={config?.generated_at ?? "new"}
            businessId={businessId}
            config={safeConfig}
            isGenerating={isGenerating}
          />
        </TabsContent>

        <TabsContent value="connect" className="mt-4">
          <WhatsappConnection
            businessId={businessId}
            config={safeConfig}
            hasAccessToken={Boolean(config?.access_token)}
            hasAppSecret={Boolean(config?.app_secret)}
            webhookUrl={webhookUrl}
            verifyToken={verifyToken}
          />
        </TabsContent>

        <TabsContent value="inbox" className="mt-4 flex flex-col gap-6">
          {pendingReplies > 0 && (
            <WhatsappFollowUps
              businessId={businessId}
              conversations={conversations}
              messagesByConversation={messagesByConversation}
            />
          )}
          <WhatsappConversations
            conversations={conversations}
            messagesByConversation={messagesByConversation}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
