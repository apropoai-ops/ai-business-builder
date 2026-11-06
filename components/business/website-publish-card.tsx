"use client";

import { useState, useTransition } from "react";
import { Globe, Loader2, Copy, Check, ExternalLink, Rocket, EyeOff, Palette } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { publishWebsiteAction } from "@/lib/actions/website";

export function WebsitePublishCard({
  businessId,
  slug: initialSlug,
  published: initialPublished,
}: {
  businessId: string;
  slug: string | null;
  published: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [published, setPublished] = useState(initialPublished);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [designing, setDesigning] = useState(false);
  const router = useRouter();

  async function generateDesign() {
    setDesigning(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/design/generate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      toast.success("הלוגו והתמונות נוצרו! האתר התעדכן 🎨");
      router.refresh();
    } catch {
      toast.error("יצירת התמונות נכשלה — נסו שוב");
    } finally {
      setDesigning(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const liveUrl = slug ? `${origin}/s/${slug}` : null;

  function toggle(publish: boolean) {
    startTransition(async () => {
      const res = await publishWebsiteAction(businessId, publish, slug || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.slug) setSlug(res.slug);
      setPublished(publish);
      toast.success(publish ? "האתר באוויר! 🚀" : "האתר הוסר מהאוויר");
    });
  }

  async function copyLink() {
    if (!liveUrl) return;
    await navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Globe className="size-4 text-primary" />
            פרסום האתר לאינטרנט
          </div>
          {published ? (
            <Badge className="bg-green-600">חי באוויר</Badge>
          ) : (
            <Badge variant="outline">טיוטה</Badge>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-1 rounded-md border bg-background px-2" dir="ltr">
            <span className="shrink-0 text-xs text-muted-foreground">/s/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="my-business"
              className="border-0 px-1 shadow-none focus-visible:ring-0"
              disabled={isPending}
            />
          </div>

          <div className="flex gap-2">
            {published ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
                  {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                  העתק קישור
                </Button>
                {liveUrl && (
                  <Button size="sm" className="gap-1.5" onClick={() => window.open(liveUrl, "_blank")}>
                    <ExternalLink className="size-3.5" />
                    צפה באתר
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => toggle(false)}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />}
                  הסר
                </Button>
              </>
            ) : (
              <Button onClick={() => toggle(true)} disabled={isPending} className="gap-1.5">
                {isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                פרסם עכשיו
              </Button>
            )}
          </div>
        </div>

        {published && liveUrl && (
          <p className="text-xs text-muted-foreground" dir="ltr">
            {liveUrl}
          </p>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-muted-foreground">
            עיצוב AI: לוגו וקטורי + רקע פתיחה בצבעי המותג (~20 שניות)
          </p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={generateDesign} disabled={designing}>
            {designing ? <Loader2 className="size-3.5 animate-spin" /> : <Palette className="size-3.5" />}
            {designing ? "מעצב..." : "צור עיצוב AI"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
