"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Users,
  Briefcase,
  Music2,
  Clock,
  Hash,
  Lightbulb,
  Layers,
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
import { SocialWatcher } from "@/components/business/social-watcher";
import type { SocialProfile } from "@/types/database";
import {
  socialPlatformLabels,
  type SocialPlatform,
} from "@/lib/ai/schemas/social-media";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  instagram: Camera,
  facebook: Users,
  linkedin: Briefcase,
  tiktok: Music2,
};

const ORDER: SocialPlatform[] = ["instagram", "facebook", "linkedin", "tiktok"];

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
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

function PlatformPanel({ profile }: { profile: SocialProfile }) {
  const pillars = asArray(profile.content_pillars);
  const times = asArray(profile.best_times);
  const hashtags = asArray(profile.hashtag_sets);
  const tips = asArray(profile.growth_tips);
  const posts = Array.isArray(profile.sample_posts)
    ? (profile.sample_posts as { title: string; body: string }[])
    : [];

  return (
    <div className="flex flex-col gap-5">
      {profile.bio && (
        <Section icon={Layers} title="ביו מומלץ">
          <Card>
            <CardContent className="flex items-start justify-between gap-2 py-3">
              <p className="text-sm leading-relaxed">{profile.bio}</p>
              <CopyBtn text={profile.bio} />
            </CardContent>
          </Card>
        </Section>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        {pillars.length > 0 && (
          <Section icon={Layers} title="עמודי תוכן">
            <ul className="space-y-1 text-sm text-foreground/90">
              {pillars.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary">•</span>
                  {p}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="space-y-5">
          {profile.posting_frequency && (
            <Section icon={Clock} title="תדירות פרסום">
              <p className="text-sm text-foreground/90">{profile.posting_frequency}</p>
            </Section>
          )}
          {times.length > 0 && (
            <Section icon={Clock} title="שעות מומלצות">
              <div className="flex flex-wrap gap-1.5">
                {times.map((t, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {t}
                  </Badge>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>

      {hashtags.length > 0 && (
        <Section icon={Hash} title="האשטאגים">
          <div className="flex flex-wrap gap-1.5">
            {hashtags.map((h, i) => (
              <span key={i} className="text-xs text-primary/80">
                #{h}
              </span>
            ))}
          </div>
        </Section>
      )}

      {posts.length > 0 && (
        <Section icon={Sparkles} title="פוסטים לדוגמה">
          <div className="space-y-2">
            {posts.map((post, i) => (
              <Card key={i}>
                <CardContent className="space-y-1.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{post.title}</p>
                    <CopyBtn text={`${post.title}\n\n${post.body}`} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground/80">
                    {post.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      )}

      {tips.length > 0 && (
        <Section icon={Lightbulb} title="טיפים לצמיחה">
          <ul className="space-y-1 text-sm text-foreground/90">
            {tips.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">→</span>
                {t}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

export function SocialView({
  businessId,
  profiles,
  isGenerating,
}: {
  businessId: string;
  profiles: SocialProfile[];
  isGenerating: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const res = await fetch(`/api/businesses/${businessId}/social/generate`, {
        method: "POST",
      });
      if (res.ok) {
        toast.success("האסטרטגיה נבנתה ✓");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "שגיאה בהפעלת הייצור — נסה שוב");
      }
    });
  }

  const generating = isGenerating || isPending;
  const byPlatform = new Map(profiles.map((p) => [p.platform, p]));
  const hasData = profiles.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-1 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {hasData
              ? "אסטרטגיה מוכנה לכל הפלטפורמות. אפשר לבנות מחדש בכל עת."
              : "בנה אסטרטגיית נוכחות מלאה ל-4 הפלטפורמות בלחיצה אחת."}
          </p>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating ? "בונה..." : hasData ? "בנה מחדש" : "בנה אסטרטגיה"}
          </Button>
        </CardContent>
      </Card>

      {generating && <SocialWatcher businessId={businessId} />}

      {!generating && hasData && (
        <Tabs defaultValue={profiles[0]?.platform ?? "instagram"} dir="rtl">
          <TabsList className="grid w-full grid-cols-4">
            {ORDER.map((p) => {
              const Icon = PLATFORM_ICONS[p];
              return (
                <TabsTrigger key={p} value={p} className="gap-1.5" disabled={!byPlatform.has(p)}>
                  <Icon className="size-3.5" />
                  <span className="hidden sm:inline">{socialPlatformLabels[p]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {ORDER.filter((p) => byPlatform.has(p)).map((p) => (
            <TabsContent key={p} value={p} className="mt-4">
              <PlatformPanel profile={byPlatform.get(p)!} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
