"use client";

import { useTransition } from "react";
import {
  Palette,
  Quote,
  Target,
  Eye,
  Sparkles,
  Type,
  Image,
  RefreshCw,
  Loader2,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

import { regenerateBrandingAction } from "@/lib/actions/branding";
import type { BrandingData } from "@/lib/ai/schemas/branding";
import type { BrandAssets } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = { businessId: string; assets: BrandAssets };

export function BrandingView({ businessId, assets }: Props) {
  const [isRegen, startRegen] = useTransition();

  const colorPalette =
    (assets.color_palette as BrandingData["colorPalette"] | null) ?? [];
  const typography = assets.typography as BrandingData["typography"] | null;
  const personality =
    (assets.personality as string[] | null) ?? [];

  function regenerate() {
    startRegen(async () => {
      const res = await regenerateBrandingAction(businessId);
      if (res?.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={regenerate} disabled={isRegen}>
          {isRegen ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          ייצור מחדש
        </Button>
      </div>

      {/* Brand identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" /> שם המותג
            </div>
            <p className="text-2xl font-bold">{assets.brand_name ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Quote className="size-4" /> סלוגן
            </div>
            <p className="text-lg font-medium italic">
              &quot;{assets.slogan ?? "—"}&quot;
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Mission & Vision */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Section icon={Target} title="משימה">
          <p className="leading-relaxed text-muted-foreground">{assets.mission ?? "—"}</p>
        </Section>
        <Section icon={Eye} title="חזון">
          <p className="leading-relaxed text-muted-foreground">{assets.vision ?? "—"}</p>
        </Section>
      </div>

      {/* Personality */}
      {personality.length > 0 && (
        <Section icon={Sparkles} title="אישיות המותג">
          <div className="flex flex-wrap gap-2">
            {personality.map((trait, i) => (
              <Badge key={i} variant="secondary" className="text-sm">
                {trait}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      {/* Brand voice */}
      {assets.brand_voice && (
        <Section icon={Quote} title="קול המותג">
          <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
            {assets.brand_voice}
          </p>
        </Section>
      )}

      {/* Color palette */}
      {colorPalette.length > 0 && (
        <Section icon={Palette} title="פלטת צבעים">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {colorPalette.map((c, i) => (
              <ColorSwatch key={i} {...c} />
            ))}
          </div>
        </Section>
      )}

      {/* Typography */}
      {typography && (
        <Section icon={Type} title="טיפוגרפיה">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                פונט ראשי
              </div>
              <div className="text-lg font-semibold">{typography.primary.font}</div>
              <div className="text-sm text-muted-foreground">{typography.primary.usage}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                פונט משני
              </div>
              <div className="text-lg font-semibold">{typography.secondary.font}</div>
              <div className="text-sm text-muted-foreground">{typography.secondary.usage}</div>
            </div>
          </div>
        </Section>
      )}

      {/* Logo prompt */}
      {assets.logo_prompt && (
        <Section icon={Image} title="פרומפט ליצירת לוגו">
          <div className="relative rounded-lg bg-muted p-4">
            <p className="pe-10 text-sm leading-relaxed text-muted-foreground">
              {assets.logo_prompt}
            </p>
            <CopyButton text={assets.logo_prompt} />
          </div>
          <p className="text-xs text-muted-foreground">
            הפרומפט הזה משמש כקו המנחה העיצובי לסטודיו העיצוב שבתוך המערכת (במסך &quot;עיצוב&quot;), ואפשר להשתמש בו גם בכלים חיצוניים כמו Midjourney או Adobe Firefly.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Palette;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-primary" />
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  );
}

function ColorSwatch({
  name,
  hex,
  usage,
}: {
  name: string;
  hex: string;
  usage: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="h-16 w-full" style={{ backgroundColor: hex }} />
      <div className="p-3">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium">{name}</span>
          <code className="text-xs text-muted-foreground">{hex}</code>
        </div>
        <p className="text-xs text-muted-foreground">{usage}</p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      onClick={copy}
      className="absolute end-3 top-3 rounded p-1 text-muted-foreground hover:text-foreground"
    >
      {copied ? <CheckCheck className="size-4 text-primary" /> : <Copy className="size-4" />}
    </button>
  );
}
