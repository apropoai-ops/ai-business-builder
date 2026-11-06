"use client";

import { useState } from "react";
import { Megaphone, Sparkles, Loader2, Copy, Check, Camera, ThumbsUp, Mail, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type Marketing = {
  instagramCaption: string;
  instagramHashtags: string[];
  facebookAd: { headline: string; body: string };
  marketingEmail: { subject: string; body: string };
  similarIdeas: string[];
};

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("הועתק ✓");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("ההעתקה נכשלה");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-primary"
      onClick={copy}
      title={label ? `העתק ${label}` : "העתק"}
    >
      {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
      העתק
    </Button>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-lg border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function ProductMarketing({
  businessId,
  productId,
  productName,
}: {
  businessId: string;
  productId: string;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Marketing | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/businesses/${businessId}/products/${productId}/marketing`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json.marketing as Marketing);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת חבילת השיווק נכשלה");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !data && !loading) void load();
  }

  return (
    <div className="w-full">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 text-xs text-primary"
        onClick={toggle}
        title={`חבילת שיווק AI ל${productName}`}
      >
        <Megaphone className="size-3.5" />
        שיווק AI
      </Button>

      {open && (
        <div className="mt-2 space-y-2.5 rounded-lg border bg-muted/30 p-2.5 text-right">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              ה-AI מכין חבילת שיווק...
            </div>
          )}

          {!loading && data && (
            <>
              {/* Instagram */}
              <Section icon={<Camera className="size-4" />} title="כיתוב לאינסטגרם">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.instagramCaption}</p>
                {data.instagramHashtags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1 text-xs text-muted-foreground">
                    {data.instagramHashtags.map((h, i) => (
                      <span key={i} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                        {h.startsWith("#") ? h : `#${h}`}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex justify-start pt-1">
                  <CopyButton
                    text={`${data.instagramCaption}\n\n${data.instagramHashtags
                      .map((h) => (h.startsWith("#") ? h : `#${h}`))
                      .join(" ")}`}
                    label="כיתוב אינסטגרם"
                  />
                </div>
              </Section>

              {/* Facebook ad */}
              <Section icon={<ThumbsUp className="size-4" />} title="מודעת פייסבוק">
                <div className="text-sm font-semibold">{data.facebookAd.headline}</div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.facebookAd.body}</p>
                <div className="flex justify-start pt-1">
                  <CopyButton
                    text={`${data.facebookAd.headline}\n\n${data.facebookAd.body}`}
                    label="מודעת פייסבוק"
                  />
                </div>
              </Section>

              {/* Marketing email */}
              <Section icon={<Mail className="size-4" />} title="מייל שיווקי">
                <div className="text-sm">
                  <span className="font-semibold">נושא: </span>
                  {data.marketingEmail.subject}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{data.marketingEmail.body}</p>
                <div className="flex justify-start pt-1">
                  <CopyButton
                    text={`נושא: ${data.marketingEmail.subject}\n\n${data.marketingEmail.body}`}
                    label="מייל שיווקי"
                  />
                </div>
              </Section>

              {/* Similar ideas */}
              <Section icon={<Lightbulb className="size-4" />} title="רעיונות למוצרים דומים">
                <ul className="list-inside list-disc space-y-0.5 text-sm">
                  {data.similarIdeas.map((idea, i) => (
                    <li key={i}>{idea}</li>
                  ))}
                </ul>
                <div className="flex justify-start pt-1">
                  <CopyButton text={data.similarIdeas.join("\n")} label="רעיונות" />
                </div>
              </Section>

              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setData(null);
                    void load();
                  }}
                  disabled={loading}
                >
                  <Sparkles className="size-3.5" />
                  צור מחדש
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
