"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ThumbsUp,
  Search,
  Music2,
  Target,
  Users,
  Megaphone,
  Image as ImageIcon,
  Wallet,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdsWatcher } from "@/components/business/ads-watcher";
import type { AdCampaign } from "@/types/database";
import { adPlatformShortLabels, type AdPlatform } from "@/lib/ai/schemas/ads";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  meta: ThumbsUp,
  google: Search,
  tiktok: Music2,
};

const ORDER: AdPlatform[] = ["meta", "google", "tiktok"];

type CampaignObj = { name?: string; objective?: string; budgetSuggestion?: string; bidStrategy?: string };
type Audience = { name?: string; description?: string; targeting?: string };
type AdCopy = { headline?: string; body?: string; cta?: string };
type Creative = { concept?: string; format?: string; visualIdea?: string };

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-3 text-green-600" /> : <Copy className="size-3" />}
      העתק
    </Button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </div>
      {children}
    </div>
  );
}

function PlatformPanel({ campaign }: { campaign: AdCampaign }) {
  const c = (campaign.campaign ?? {}) as CampaignObj;
  const audiences = asArray<Audience>(campaign.audiences);
  const adCopies = asArray<AdCopy>(campaign.ad_copies);
  const creatives = asArray<Creative>(campaign.creatives);

  return (
    <div className="flex flex-col gap-5">
      {campaign.objective && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">מטרה: {campaign.objective}</Badge>
        </div>
      )}

      <Section icon={Megaphone} title="מבנה הקמפיין">
        <Card>
          <CardContent className="grid gap-3 py-4 sm:grid-cols-2">
            {c.name && (
              <div>
                <div className="text-xs text-muted-foreground">שם קמפיין</div>
                <div className="text-sm font-medium">{c.name}</div>
              </div>
            )}
            {c.objective && (
              <div>
                <div className="text-xs text-muted-foreground">יעד</div>
                <div className="text-sm font-medium">{c.objective}</div>
              </div>
            )}
            {c.budgetSuggestion && (
              <div className="flex items-start gap-2">
                <Wallet className="mt-0.5 size-4 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">תקציב מומלץ</div>
                  <div className="text-sm font-medium">{c.budgetSuggestion}</div>
                </div>
              </div>
            )}
            {c.bidStrategy && (
              <div className="flex items-start gap-2">
                <Target className="mt-0.5 size-4 text-primary" />
                <div>
                  <div className="text-xs text-muted-foreground">אסטרטגיית הצעה</div>
                  <div className="text-sm font-medium">{c.bidStrategy}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      {audiences.length > 0 && (
        <Section icon={Users} title="קהלי יעד">
          <div className="grid gap-2 sm:grid-cols-2">
            {audiences.map((a, i) => (
              <Card key={i}>
                <CardContent className="space-y-1 py-3">
                  <p className="text-sm font-medium">{a.name}</p>
                  {a.description && <p className="text-xs text-muted-foreground">{a.description}</p>}
                  {a.targeting && (
                    <p className="text-xs text-foreground/80">
                      <span className="text-muted-foreground">מיקוד: </span>
                      {a.targeting}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {adCopies.length > 0 && (
        <Section icon={Sparkles} title="טקסטים למודעה">
          <div className="space-y-2">
            {adCopies.map((ad, i) => (
              <Card key={i}>
                <CardContent className="space-y-1.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{ad.headline}</p>
                    <CopyBtn text={`${ad.headline ?? ""}\n\n${ad.body ?? ""}`} />
                  </div>
                  {ad.body && <p className="whitespace-pre-wrap text-sm text-foreground/80">{ad.body}</p>}
                  {ad.cta && (
                    <Badge className="bg-primary/90 text-xs">{ad.cta}</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {creatives.length > 0 && (
        <Section icon={ImageIcon} title="רעיונות קריאייטיב">
          <div className="grid gap-2 sm:grid-cols-2">
            {creatives.map((cr, i) => (
              <Card key={i}>
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{cr.concept}</p>
                    {cr.format && <Badge variant="outline" className="text-[10px]">{cr.format}</Badge>}
                  </div>
                  {cr.visualIdea && <p className="text-xs text-muted-foreground">{cr.visualIdea}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

export function AdsView({
  businessId,
  campaigns,
  isGenerating,
}: {
  businessId: string;
  campaigns: AdCampaign[];
  isGenerating: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleGenerate() {
    startTransition(async () => {
      const res = await fetch(`/api/businesses/${businessId}/ads/generate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("תוכנית הפרסום נבנתה ✓");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "שגיאה בהפעלת הייצור — נסה שוב");
      }
    });
  }

  const generating = isGenerating || isPending;
  const byPlatform = new Map(campaigns.map((c) => [c.platform, c]));
  const hasData = campaigns.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-1 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {hasData
              ? "תוכנית פרסום מוכנה לכל הפלטפורמות. אפשר לבנות מחדש בכל עת."
              : "בנה תוכנית פרסום ממומן מלאה ל-Meta, Google ו-TikTok בלחיצה אחת."}
          </p>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "בונה..." : hasData ? "בנה מחדש" : "בנה תוכנית פרסום"}
          </Button>
        </CardContent>
      </Card>

      {generating && <AdsWatcher businessId={businessId} />}

      {!generating && hasData && (
        <Tabs defaultValue={campaigns[0]?.platform ?? "meta"} dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            {ORDER.map((p) => {
              const Icon = PLATFORM_ICONS[p];
              return (
                <TabsTrigger key={p} value={p} className="gap-1.5" disabled={!byPlatform.has(p)}>
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{adPlatformShortLabels[p]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {ORDER.filter((p) => byPlatform.has(p)).map((p) => (
            <TabsContent key={p} value={p} className="mt-4">
              <PlatformPanel campaign={byPlatform.get(p)!} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
