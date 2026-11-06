"use client";

import { useRef, useState, useTransition } from "react";
import { Star, Loader2, Send, CheckCircle2, ImagePlus, X } from "lucide-react";

import { submitReviewAction } from "@/lib/actions/reviews";
import { inkOn } from "@/lib/storefront-brand";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function SiteReviewForm({
  slug,
  brandColor,
}: {
  slug: string;
  brandColor: string;
}) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [content, setContent] = useState("");
  const [hp, setHp] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      clearImage();
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("תמונה בפורמט לא נתמך (PNG/JPEG/WEBP בלבד)");
      clearImage();
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("התמונה גדולה מדי (עד 4MB)");
      clearImage();
      return;
    }
    setImage(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearImage() {
    setImage(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError("נא לבחור דירוג");
      return;
    }
    startTransition(async () => {
      const res = await submitReviewAction(slug, {
        name,
        rating,
        content,
        image,
        company_website: hp,
      });
      if (!res.ok) setError(res.error ?? "השליחה נכשלה");
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="size-10" style={{ color: brandColor }} />
        <p className="text-lg font-semibold">תודה! הביקורת תפורסם לאחר אישור</p>
        <p className="text-sm text-zinc-500">אנחנו מעריכים את הזמן שהקדשתם 🙏</p>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2";
  const shown = hovered || rating;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-white p-6 shadow-sm">
      {/* Honeypot — invisible to humans, irresistible to bots */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
        aria-hidden="true"
      />

      {/* Rating picker */}
      <div className="flex items-center justify-center gap-1.5 py-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`${i} כוכבים`}
            onClick={() => setRating(i)}
            onMouseEnter={() => setHovered(i)}
            className="transition-transform hover:scale-110"
          >
            <Star
              className="size-8"
              style={
                i <= shown
                  ? { color: brandColor, fill: brandColor }
                  : { color: "#d4d4d8", fill: "transparent" }
              }
            />
          </button>
        ))}
      </div>

      <input
        className={inputCls}
        placeholder="שם מלא *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
        maxLength={80}
      />
      <textarea
        className={inputCls}
        placeholder="ספרו על החוויה שלכם *"
        rows={4}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        required
        minLength={5}
        maxLength={600}
      />

      {/* Optional customer photo */}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onPickImage}
        className="hidden"
      />
      {preview ? (
        <div className="relative w-full overflow-hidden rounded-lg border border-zinc-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="תצוגה מקדימה" className="max-h-48 w-full object-cover" />
          <button
            type="button"
            onClick={clearImage}
            aria-label="הסרת התמונה"
            className="absolute end-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2.5 text-sm text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700"
        >
          <ImagePlus className="size-4" />
          הוספת תמונה (לא חובה)
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isPending || name.trim().length < 2 || content.trim().length < 5 || rating < 1}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        שליחת ביקורת
      </button>
    </form>
  );
}
