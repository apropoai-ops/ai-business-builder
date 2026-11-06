"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveSocialLinksAction } from "@/lib/actions/design";
import { SOCIAL_PLATFORMS, type SocialLink, type SocialPlatform } from "@/lib/social-links";

type RowState = { url: string; enabled: boolean };

/**
 * Owner-facing editor for the storefront social links: every known platform
 * gets a row with its brand icon, a URL field and an on/off switch. Only
 * enabled platforms with a valid https link render on the public site.
 */
export function SocialLinksManager({
  businessId,
  links,
}: {
  businessId: string;
  links: SocialLink[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<SocialPlatform, RowState>>(() => {
    const initial = {} as Record<SocialPlatform, RowState>;
    for (const p of SOCIAL_PLATFORMS) {
      const saved = links.find((l) => l.platform === p.key);
      initial[p.key] = { url: saved?.url ?? "", enabled: saved?.enabled ?? false };
    }
    return initial;
  });
  const [saving, startSaving] = useTransition();

  const visibleCount = SOCIAL_PLATFORMS.filter(
    (p) => rows[p.key].enabled && rows[p.key].url.trim().startsWith("https://"),
  ).length;

  function update(key: SocialPlatform, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  function save() {
    startSaving(async () => {
      const payload: SocialLink[] = SOCIAL_PLATFORMS.filter((p) => rows[p.key].url.trim()).map(
        (p) => ({
          platform: p.key,
          url: rows[p.key].url.trim(),
          enabled: rows[p.key].enabled,
        }),
      );
      const res = await saveSocialLinksAction(businessId, payload);
      if (res.error) toast.error(res.error);
      else {
        toast.success(
          res.visible
            ? `נשמר ✓ ${res.visible} רשתות מוצגות באתר`
            : "נשמר ✓ (אף רשת לא מוצגת כרגע — הדליקו מתג והוסיפו קישור)",
        );
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <span className="text-sm font-semibold">הרשתות החברתיות שלכם באתר</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {visibleCount > 0 ? `${visibleCount} רשתות יוצגו באתר` : "אף רשת לא מוצגת כרגע"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          הדביקו קישור לכל פלטפורמה והדליקו את המתג — האייקונים יופיעו אוטומטית באתר שלכם. רק רשתות
          דלוקות עם קישור תקין (https) מוצגות.
        </p>

        <div className="grid gap-2 lg:grid-cols-2">
          {SOCIAL_PLATFORMS.map((p) => {
            const row = rows[p.key];
            const active = row.enabled && row.url.trim().startsWith("https://");
            return (
              <div
                key={p.key}
                className={`flex items-center gap-3 rounded-xl border p-2.5 transition ${active ? "border-primary/40 bg-primary/[0.03]" : "border-input"}`}
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-white"
                  style={{ color: row.enabled ? p.color : "#a1a1aa" }}
                >
                  <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor" aria-hidden="true">
                    <path d={p.path} />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 text-xs font-medium">{p.label}</div>
                  <Input
                    value={row.url}
                    onChange={(e) => update(p.key, { url: e.target.value })}
                    placeholder={p.placeholder}
                    dir="ltr"
                    className="h-8 text-xs"
                  />
                </div>
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(checked) => update(p.key, { enabled: checked })}
                  aria-label={`הצגת ${p.label} באתר`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
