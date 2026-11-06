import { notFound } from "next/navigation";

import { getBusiness } from "@/lib/services/business.service";
import { listMessages } from "@/lib/services/ceo-chat.service";
import { CeoChat } from "@/components/business/ceo-chat";

export const metadata = { title: "AI CEO" };

export default async function CeoChatPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const messages = await listMessages(businessId);

  return <CeoChat businessId={businessId} initialMessages={messages} />;
}
