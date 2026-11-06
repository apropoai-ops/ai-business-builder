"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setHeroParticlesAction } from "@/lib/actions/design";

/**
 * Owner toggle for the "professional" tier's particle-dust + HUD corner-label
 * hero overlay. Some hero styles (denim: "nothing floats, nothing
 * parallaxes"; vanguard: already has its own dot-grid) are built to NOT have
 * this — the overlay used to be forced on regardless of style, which read as
 * a bug rather than a look. Defaults to on, matching the historical always-on
 * behaviour.
 */
export function HeroParticlesToggle({
  businessId,
  enabled: initialEnabled,
}: {
  businessId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await setHeroParticlesAction(businessId, next);
      if (res.error) {
        setEnabled(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "אפקט הנקודות הופעל ✓" : "אפקט הנקודות כובה ✓");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3 py-4">
        <div>
          <span className="text-sm font-semibold">אפקט נקודות מרחפות ב-Hero</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            שכבת נקודות זוהרות ותוויות פינה שצפה מעל אזור הפתיחה. בסגנונות כמו
            Denim ו-Vanguard, שנבנו להיות שטוחים בכוונה, כדאי לרוב לכבות.
          </p>
        </div>
        <Switch checked={enabled} disabled={isPending} onCheckedChange={toggle} />
      </CardContent>
    </Card>
  );
}
