"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  ImagePlus,
  Images,
  Loader2,
  Play,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveLandingSettingsAction } from "@/lib/actions/landing-settings";
import { uploadModuleImageAction } from "@/lib/actions/module-image";
import {
  MAX_COUNTDOWN_LABEL,
  MAX_GALLERY_IMAGES,
  countdownIsoFromLocal,
  countdownLocalFromIso,
  isCountdownExpired,
} from "@/lib/landing-settings";
import { toVideoEmbedUrl } from "@/lib/video-embed";
import type { LandingSettings } from "@/lib/ai/schemas/landing";

/**
 * The owner-facing half of the landing page: the three things the AI can't
 * write for them — when the offer closes, which video to show, and which real
 * photos to put in the gallery.
 *
 * Everything here is stored in ONE jsonb column, so the form saves as one unit
 * rather than field-by-field. Uploads are the exception: an uploaded image is
 * live in storage the moment it returns, so it goes straight into the pending
 * list and is persisted with the next save.
 *
 * Validation is duplicated on purpose — the same pure helpers from
 * lib/landing-settings.ts run here for instant feedback and again in the server
 * action, which is the real boundary.
 */
export function LandingSettingsManager({
  businessId,
  settings,
}: {
  businessId: string;
  settings: LandingSettings;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [countdownEnabled, setCountdownEnabled] = useState(
    settings.countdownEnabled === true,
  );
  const [endsAt, setEndsAt] = useState(() =>
    countdownLocalFromIso(settings.countdownEndsAt),
  );
  const [label, setLabel] = useState(settings.countdownLabel ?? "");
  const [videoUrl, setVideoUrl] = useState(settings.videoUrl ?? "");
  const [gallery, setGallery] = useState<string[]>(settings.galleryUrls ?? []);

  const [saving, startSaving] = useTransition();
  const [uploading, startUpload] = useTransition();

  // Rendering must stay pure (react-hooks/purity is an error here), so "now" is
  // sampled once on mount — a warning that flips mid-edit would be noise anyway.
  const [mountedAt] = useState(() => new Date().toISOString());

  const videoEmbed = toVideoEmbedUrl(videoUrl);
  const videoInvalid = videoUrl.trim().length > 0 && !videoEmbed;
  const countdownExpired = isCountdownExpired(
    { countdownEnabled, countdownEndsAt: countdownIsoFromLocal(endsAt) },
    Date.parse(mountedAt),
  );

  function upload(files: FileList) {
    const room = MAX_GALLERY_IMAGES - gallery.length;
    if (room <= 0) {
      toast.error(`אפשר עד ${MAX_GALLERY_IMAGES} תמונות`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) {
      toast.warning(`נוספו ${picked.length} תמונות — הגעתם למקסימום`);
    }

    startUpload(async () => {
      const added: string[] = [];
      for (const file of picked) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await uploadModuleImageAction(businessId, fd);
        if (res.error || !res.url) {
          toast.error(res.error ?? "ההעלאה נכשלה");
          break;
        }
        added.push(res.url);
      }
      if (added.length > 0) {
        setGallery((prev) => [...prev, ...added].slice(0, MAX_GALLERY_IMAGES));
        toast.success(
          added.length === 1 ? "התמונה הועלתה — לחצו שמירה" : `${added.length} תמונות הועלו — לחצו שמירה`,
        );
      }
    });
  }

  function save() {
    startSaving(async () => {
      const res = await saveLandingSettingsAction(businessId, {
        countdownEnabled,
        countdownEndsAt: endsAt,
        countdownLabel: label,
        videoUrl,
        galleryUrls: gallery,
      });
      if (!res.ok) {
        toast.error(res.error ?? "השמירה נכשלה");
        return;
      }
      toast.success("ההגדרות נשמרו — הדף עודכן");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">הגדרות דף הנחיתה</CardTitle>
        <CardDescription>
          טיימר, סרטון ותמונות — שלושת החלקים שה-AI משאיר לכם. סקשן שאין לו תוכן
          פשוט לא מוצג בדף.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* ── טיימר ── */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock className="size-4 text-primary" />
              טיימר ספירה לאחור
            </div>
            <Switch
              checked={countdownEnabled}
              onCheckedChange={setCountdownEnabled}
              aria-label="הצגת טיימר בדף"
            />
          </div>

          {countdownEnabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="landing-ends-at" className="text-xs font-medium">
                  תאריך ושעת סיום (שעון ישראל)
                </label>
                <Input
                  id="landing-ends-at"
                  type="datetime-local"
                  dir="ltr"
                  className="text-left"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="landing-label" className="text-xs font-medium">
                  תווית מעל הטיימר
                </label>
                <Input
                  id="landing-label"
                  maxLength={MAX_COUNTDOWN_LABEL}
                  placeholder="ההרשמה נסגרת בעוד"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
            </div>
          )}

          {countdownEnabled && !endsAt && (
            <p className="text-xs text-destructive">בחרו תאריך ושעה כדי להפעיל את הטיימר.</p>
          )}
          {countdownExpired && (
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <TriangleAlert className="size-3.5 shrink-0" />
              המועד כבר עבר — טיימר שהסתיים נעלם מהדף לגמרי.
            </p>
          )}
          {!countdownEnabled && (
            <p className="text-xs text-muted-foreground">
              כשהטיימר כבוי מוצגת במקומו שורת הדחיפות שה-AI כתב.
            </p>
          )}
        </section>

        {/* ── סרטון ── */}
        <section className="flex flex-col gap-2 border-t pt-5">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Play className="size-4 text-primary" />
            סרטון
          </div>
          <Input
            dir="ltr"
            className="text-left"
            placeholder="https://www.youtube.com/watch?v=..."
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            aria-invalid={videoInvalid}
          />
          {videoInvalid ? (
            <p className="text-xs text-destructive">
              הקישור לא נתמך. הדביקו קישור YouTube (כולל Shorts) או Vimeo.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {videoEmbed
                ? "הקישור תקין — סקשן הסרטון יוצג בדף."
                : "בלי קישור סקשן הסרטון לא מוצג."}
            </p>
          )}
          {videoEmbed && (
            <div className="mt-1 max-w-sm overflow-hidden rounded-xl bg-black">
              <iframe
                src={videoEmbed}
                title="תצוגה מקדימה של הסרטון"
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                className="aspect-video w-full"
              />
            </div>
          )}
        </section>

        {/* ── גלריה ── */}
        <section className="flex flex-col gap-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Images className="size-4 text-primary" />
              תמונות הגלריה
            </div>
            <span className="text-xs text-muted-foreground">
              {gallery.length}/{MAX_GALLERY_IMAGES}
            </span>
          </div>

          {gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((url, i) => (
                <div key={url} className="group relative overflow-hidden rounded-xl border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`תמונה ${i + 1}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`הסרת תמונה ${i + 1}`}
                    className="absolute end-1 top-1 size-7 bg-white/90 text-muted-foreground shadow-sm hover:text-destructive"
                    onClick={() => setGallery((prev) => prev.filter((u) => u !== url))}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={uploading || gallery.length >= MAX_GALLERY_IMAGES}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ImagePlus className="size-4" />
              )}
              העלאת תמונות
            </Button>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) upload(files);
                e.target.value = "";
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            PNG/JPG/WebP עד 12MB. הכיתובים שמתחת לתמונות נכתבו על ידי ה-AI לפי
            הסדר שכאן — התמונה הראשונה מקבלת את הכיתוב הראשון.
          </p>
        </section>

        <div className="flex justify-end border-t pt-4">
          <Button onClick={save} disabled={saving || uploading} className="gap-1.5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
