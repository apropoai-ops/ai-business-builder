"use client";

import { useRef, useState, useTransition } from "react";
import { Sparkles, Upload, Loader2, Check, ImageIcon, Wand2, Camera, Search, Download, Sun, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  uploadLogoAction,
  uploadHeroAction,
  chooseLogoAction,
  brandHeroAction,
  searchHeroPhotosAction,
  chooseHeroPhotoAction,
} from "@/lib/actions/design";
import type { StockPhotoCandidate } from "@/lib/services/stock-photo";

/**
 * Hero thumbnail that says what went wrong instead of rendering the browser's
 * broken-image glyph. An owner who sees a torn-page icon has no idea whether
 * the upload failed, the file is bad, or the site is down — and that ambiguity
 * is exactly what made a storage bug read as "it doesn't upload". Keyed on the
 * URL by the caller so a fresh upload always remounts and retries.
 */
function HeroPreview({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-lg border border-destructive/40 bg-destructive/5 text-center">
        <ImageIcon className="size-6 text-destructive/60" />
        <span className="px-3 text-[11px] text-destructive">
          התמונה השמורה לא נטענת — העלו אותה מחדש
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="תמונת הנושא הנוכחית"
      onError={() => setBroken(true)}
      className="h-28 w-full rounded-lg border object-cover"
    />
  );
}

export function DesignStudio({
  businessId,
  logoUrl,
  heroUrl,
  brandHex,
  defaultName = "",
  defaultIndustry = "",
}: {
  businessId: string;
  logoUrl: string | null;
  heroUrl: string | null;
  brandHex: string;
  defaultName?: string;
  defaultIndustry?: string;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const heroFileRef = useRef<HTMLInputElement>(null);
  const [heroQuery, setHeroQuery] = useState("");
  const [logoName, setLogoName] = useState(defaultName);
  const [logoIndustry, setLogoIndustry] = useState(defaultIndustry);
  const [photoCandidates, setPhotoCandidates] = useState<StockPhotoCandidate[]>([]);
  const [searchingPhotos, startSearchPhotos] = useTransition();
  // Defaults to dark because that IS the live header on every site (the
  // professional tier paints it rgba(0,0,0,.72)).
  const [logoBg, setLogoBg] = useState<"light" | "dark">("dark");
  const [downloading, setDownloading] = useState<string | null>(null);

  const fileBase = (logoName || defaultName || "logo").trim().replace(/\s+/g, "-").slice(0, 40) || "logo";

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /** Rasterizes an SVG (fetched as text) to a transparent high-res PNG via canvas. */
  async function downloadLogo(url: string, format: "svg" | "png", base: string) {
    const key = `${format}:${url}`;
    setDownloading(key);
    try {
      const isSvg = /\.svg(\?|$)/i.test(url);
      if (format === "svg") {
        if (!isSvg) {
          // Raster upload — just download the original file as-is.
          const blob = await (await fetch(url)).blob();
          const obj = URL.createObjectURL(blob);
          triggerDownload(obj, `${base}${url.match(/\.(png|jpe?g|webp)/i)?.[0] ?? ""}`);
          setTimeout(() => URL.revokeObjectURL(obj), 5000);
        } else {
          const text = await (await fetch(url)).text();
          const obj = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
          triggerDownload(obj, `${base}.svg`);
          setTimeout(() => URL.revokeObjectURL(obj), 5000);
        }
      } else {
        // PNG: for SVG sources rasterize via a data-URL image (keeps the canvas
        // untainted so toDataURL works); for raster sources re-encode as PNG.
        const size = 1024;
        let src = url;
        let ratio = 0.5;
        if (isSvg) {
          const text = await (await fetch(url)).text();
          const vb = text.match(/viewBox=["']([-\d.\s]+)["']/);
          if (vb) {
            const p = vb[1].trim().split(/\s+/).map(Number);
            if (p.length === 4 && p[2] > 0) ratio = p[3] / p[2];
          }
          const bytes = new TextEncoder().encode(text);
          let bin = "";
          bytes.forEach((b) => (bin += String.fromCharCode(b)));
          src = `data:image/svg+xml;base64,${btoa(bin)}`;
        } else {
          // Raster from storage: draw via a same-origin blob URL — a
          // cross-origin <img> without CORS taints the canvas and makes
          // toDataURL throw a SecurityError.
          const blob = await (await fetch(url)).blob();
          src = URL.createObjectURL(blob);
        }
        const img = new Image();
        img.decoding = "async";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("load"));
          img.src = src;
        });
        if (!isSvg && img.naturalWidth > 0) ratio = img.naturalHeight / img.naturalWidth;
        const w = size;
        const h = Math.max(1, Math.round(size * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no ctx");
        ctx.drawImage(img, 0, 0, w, h);
        triggerDownload(canvas.toDataURL("image/png"), `${base}.png`);
        if (!isSvg) setTimeout(() => URL.revokeObjectURL(src), 5000);
      }
    } catch {
      toast.error("ההורדה נכשלה — נסו שוב");
    } finally {
      setDownloading(null);
    }
  }

  async function generateOptions() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/design/logo-options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: logoName, industry: logoIndustry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOptions(data.options);
      toast.success("3 הצעות מוכנות — בחרו את האהובה עליכם");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "יצירת ההצעות נכשלה");
    } finally {
      setGenerating(false);
    }
  }

  async function pick(url: string) {
    setBusy(url);
    const res = await chooseLogoAction(businessId, url);
    if (res.error) toast.error(res.error);
    else {
      toast.success("הלוגו עודכן בכל האתר ✓");
      router.refresh();
    }
    setBusy(null);
  }

  async function uploadFile(kind: "logo" | "hero", file: File) {
    setBusy(kind);
    const fd = new FormData();
    fd.append("file", file);
    const res =
      kind === "logo"
        ? await uploadLogoAction(businessId, fd)
        : await uploadHeroAction(businessId, fd);
    if (res.error) toast.error(res.error);
    else {
      toast.success(kind === "logo" ? "הלוגו שלכם הועלה ✓" : "תמונת הנושא הועלתה והותאמה לאתר ✓");
      // Accepted, not rejected — but a 400px photo blown up to a full-bleed
      // hero looks soft, and the owner should hear that from us rather than
      // discover it on their live site.
      if ("lowRes" in res && res.lowRes) {
        toast.warning("התמונה שהעליתם קטנה יחסית — היא הותאמה, אבל תיראה חדה יותר עם תמונה גדולה");
      }
      router.refresh();
    }
    setBusy(null);
  }

  async function regenHero() {
    setBusy("hero-gen");
    const res = await brandHeroAction(businessId, brandHex);
    if (res.error) toast.error(res.error);
    else {
      toast.success("רקע חדש נוצר עם שם העסק וצבעי המותג ✓");
      router.refresh();
    }
    setBusy(null);
  }

  function searchPhotos() {
    startSearchPhotos(async () => {
      const res = await searchHeroPhotosAction(businessId, heroQuery);
      if (res.error) {
        toast.error(res.error);
        setPhotoCandidates([]);
      } else {
        setPhotoCandidates(res.photos ?? []);
        if (!res.photos?.length) toast.error("לא נמצאו תמונות מתאימות — נסו ניסוח אחר");
      }
    });
  }

  async function choosePhoto(photo: StockPhotoCandidate) {
    setBusy(photo.imageUrl);
    const res = await chooseHeroPhotoAction(businessId, photo.imageUrl, photo.credit);
    if (res.error) toast.error(res.error);
    else {
      toast.success("תמונה אמיתית הוגדרה כרקע ✓");
      setPhotoCandidates([]);
      router.refresh();
    }
    setBusy(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Logo studio */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="text-sm font-semibold">לוגו</div>
              {/* The light/dark switch used to live inside the "AI options"
                  block, so an owner who uploaded their OWN logo never saw the
                  dark preview — and never discovered that a dark-ink logo
                  disappears in the site's dark header. */}
              <div className="inline-flex overflow-hidden rounded-md border">
                <button
                  type="button"
                  onClick={() => setLogoBg("light")}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition ${logoBg === "light" ? "bg-primary text-white" : "hover:bg-muted"}`}
                >
                  <Sun className="size-3" />
                  בהיר
                </button>
                <button
                  type="button"
                  onClick={() => setLogoBg("dark")}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition ${logoBg === "dark" ? "bg-primary text-white" : "hover:bg-muted"}`}
                >
                  <Moon className="size-3" />
                  כהה
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">כך הלוגו ייראה בהדר האתר</p>
            </div>
            {logoUrl && (
              <div className="flex items-center gap-2">
                {/* Same box the storefront header uses: fixed height, free
                    width — not a 2:1 rectangle the real site never renders. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="הלוגו הנוכחי" className={`h-10 w-auto max-w-[168px] rounded-lg border object-contain p-1 ${logoBg === "dark" ? "bg-zinc-900" : "bg-white"}`} />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => downloadLogo(logoUrl, "png", `${fileBase}`)}
                    disabled={downloading !== null}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    {downloading === `png:${logoUrl}` ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    PNG
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadLogo(logoUrl, "svg", `${fileBase}`)}
                    disabled={downloading !== null}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition hover:bg-muted disabled:opacity-50"
                  >
                    {downloading === `svg:${logoUrl}` ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                    {/\.svg(\?|$)/i.test(logoUrl) ? "SVG" : "מקור"}
                  </button>
                </div>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            הלוגואים וקטוריים (SVG) ונבנים משם העסק — חדים בכל גודל, בעברית תקינה, וחינם לגמרי. לא מרוצים? צרו שוב, כמה פעמים שתרצו.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">שם העסק ללוגו</label>
              <Input value={logoName} onChange={(e) => setLogoName(e.target.value)} placeholder="שם העסק" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">תחום / סגנון</label>
              <Input value={logoIndustry} onChange={(e) => setLogoIndustry(e.target.value)} placeholder="למשל: אופנה, מסעדה, היי-טק" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generateOptions} disabled={generating} className="gap-1.5">
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "מעצב 3 הצעות..." : "צור 3 הצעות AI"}
            </Button>
            <Button variant="outline" className="gap-1.5"
              onClick={() => logoFileRef.current?.click()} disabled={busy === "logo"}>
              {busy === "logo" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              העלו לוגו משלכם
            </Button>
            <input ref={logoFileRef} type="file" hidden accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Reset so picking the SAME filename again still fires a change
                // event — without this, re-selecting after a failed upload (the
                // retry this UI itself prompts for) closed the file dialog and
                // did nothing at all, with no error and no indication why.
                e.target.value = "";
                if (file) uploadFile("logo", file);
              }} />
          </div>

          {options.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">בחרו הצעה — ההורדה זמינה גם לפני הבחירה</span>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {options.map((url, i) => (
                  <div key={url} className="group relative rounded-xl border-2 border-transparent p-2 transition-colors hover:border-primary">
                    <button onClick={() => pick(url)} disabled={busy === url} className="block w-full" title="בחר לוגו זה">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="הצעת לוגו" className={`aspect-square w-full rounded-lg border object-contain ${logoBg === "dark" ? "bg-zinc-900" : "bg-white"}`} />
                      <span className="absolute inset-x-0 bottom-9 mx-auto flex w-fit items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {busy === url ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                        בחר
                      </span>
                    </button>
                    <div className="mt-1 flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => downloadLogo(url, "png", `${fileBase}-${i + 1}`)}
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition hover:bg-muted disabled:opacity-50"
                      >
                        {downloading === `png:${url}` ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                        PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadLogo(url, "svg", `${fileBase}-${i + 1}`)}
                        disabled={downloading !== null}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium transition hover:bg-muted disabled:opacity-50"
                      >
                        {downloading === `svg:${url}` ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
                        {/\.svg(\?|$)/i.test(url) ? "SVG" : "מקור"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hero studio */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="text-sm font-semibold">תמונת נושא (רקע פתיחה באתר)</div>
          {heroUrl ? (
            <HeroPreview key={heroUrl} url={heroUrl} />
          ) : (
            <div className="flex h-28 w-full items-center justify-center rounded-lg border bg-muted">
              <ImageIcon className="size-7 text-muted-foreground/40" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-1.5"
              onClick={() => heroFileRef.current?.click()} disabled={busy === "hero"}>
              {busy === "hero" ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              העלו תמונה משלכם
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={regenHero} disabled={busy === "hero-gen"}>
              {busy === "hero-gen" ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              {busy === "hero-gen" ? "יוצר רקע..." : "צור רקע עם שם העסק"}
            </Button>
            {/* Any still image: phones hand us HEIC, screenshots arrive as AVIF.
                The server crops and re-encodes whatever comes in. */}
            <input ref={heroFileRef} type="file" hidden accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                // Same reset as the logo input above — re-picking the same
                // file after a failed upload otherwise does nothing.
                e.target.value = "";
                if (file) uploadFile("hero", file);
              }} />
          </div>

          {/* Free real photo — two-step picker: search, then choose from a grid */}
          <div className="space-y-2 rounded-lg bg-muted/40 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="מה לחפש? אפשר בעברית פשוטה (לא חובה)"
                className="h-9 min-w-[150px] flex-1 bg-background"
              />
              <Button className="gap-1.5" onClick={searchPhotos} disabled={searchingPhotos}>
                {searchingPhotos ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                חיפוש
              </Button>
            </div>

            {photoCandidates.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {photoCandidates.map((photo) => (
                  <button
                    key={photo.imageUrl}
                    onClick={() => choosePhoto(photo)}
                    disabled={busy === photo.imageUrl}
                    className="group relative overflow-hidden rounded-lg border-2 border-transparent text-start transition-colors hover:border-primary"
                    title={photo.credit}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.thumbUrl} alt={photo.credit} className="aspect-video w-full object-cover" />
                    <span className="block truncate bg-background/80 px-1 py-0.5 text-[9px] text-muted-foreground">
                      {photo.credit}
                    </span>
                    <span className="absolute inset-x-0 top-1 mx-auto flex w-fit items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {busy === photo.imageUrl ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                      בחר
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            כל התמונות חופשיות לשימוש מסחרי (CC0 / רישיון חופשי) — קרדיט מוצג אוטומטית. תמיד אפשר להעלות תמונה משלכם למעלה ☝️
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
