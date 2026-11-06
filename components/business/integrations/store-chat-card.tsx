"use client";

import { useState, useTransition } from "react";
import { Bot } from "lucide-react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { IntegrationCard, StatusBadge } from "@/components/business/integrations/integration-card";
import { toggleStoreChatAction } from "@/lib/actions/store-chat";

export function StoreChatCard({
  businessId,
  enabled: initialEnabled,
}: {
  businessId: string;
  enabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await toggleStoreChatAction(businessId, next);
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.error ?? "העדכון נכשל");
        return;
      }
      toast.success(next ? "הצ'אט הופעל ✓" : "הצ'אט כובה");
    });
  }

  return (
    <IntegrationCard
      icon={Bot}
      title="צ'אט AI באתר"
      subtitle="עוזר מכירות חכם שצץ באתר החנות ועונה על שאלות לקוחות בזמן אמת"
      status={<StatusBadge status={enabled ? "connected" : "not-connected"} />}
    >
      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium">הצגת הצ&apos;אט באתר</span>
        <Switch checked={enabled} disabled={isPending} onCheckedChange={toggle} />
      </div>
    </IntegrationCard>
  );
}
