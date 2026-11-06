import { requireUser } from "@/lib/auth/user";
import { WhatsappGuideContent } from "@/components/business/whatsapp-guide-content";

export const metadata = { title: "מדריך חיבור סוכן וואטסאפ" };

export default async function WhatsappGuidePage() {
  await requireUser();
  return <WhatsappGuideContent />;
}
