"use client";

import { useRef, useTransition } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { uploadModuleImageAction } from "@/lib/actions/module-image";
import { Button } from "@/components/ui/button";

type Props = {
  businessId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
};

/**
 * Multi-image picker for module content forms — the plural sibling of
 * <ImageField>. Uploads each file via uploadModuleImageAction and hands the
 * ordered CDN URL list to the parent, which persists it (images text[]).
 *
 * Order is meaningful: index 0 is the cover, so the parent should mirror it
 * onto its single image_url column for thumbnails and older render paths.
 */
export function ImagesField({
  businessId,
  value,
  onChange,
  max = 8,
  label = "תמונות (אופציונלי)",
  hint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();

  const room = max - value.length;

  function pick(files: FileList) {
    if (room <= 0) {
      toast.error(`אפשר עד ${max} תמונות`);
      return;
    }
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) {
      toast.warning(`נבחרו ${picked.length} תמונות — הגעתם למקסימום`);
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
        onChange([...value, ...added].slice(0, max));
        toast.success(
          added.length === 1 ? "התמונה הועלתה" : `${added.length} תמונות הועלו`,
        );
      }
    });
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  /** Swap with the neighbour. `delta` is -1 for earlier (cover-ward), +1 for later. */
  function move(i: number, delta: number) {
    const j = i + delta;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {value.length}/{max}
        </span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((url, i) => (
            <div key={`${url}-${i}`} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={i === 0 ? "תמונה ראשית" : `תמונה ${i + 1}`}
                loading="lazy"
                className="size-20 rounded-lg border object-cover"
              />
              {i === 0 && (
                <span className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[10px] font-medium text-white">
                  ראשית
                </span>
              )}
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`הסרת תמונה ${i + 1}`}
                className="absolute -end-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-sm hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
              {value.length > 1 && (
                <div className="mt-1 flex justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`הזזת תמונה ${i + 1} קדימה`}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    aria-label={`הזזת תמונה ${i + 1} אחורה`}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading || room <= 0}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {value.length > 0 ? "הוספת תמונות" : "העלאת תמונות"}
        </Button>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) pick(files);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
