"use client";

import { useRef, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { uploadModuleImageAction } from "@/lib/actions/module-image";
import { Button } from "@/components/ui/button";

type Props = {
  businessId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
};

/**
 * Reusable optional-image picker for module content forms.
 * Uploads via uploadModuleImageAction and hands the CDN URL to the parent —
 * the parent form persists it on its content row (image_url).
 */
export function ImageField({
  businessId,
  value,
  onChange,
  label = "תמונה (אופציונלי)",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();

  function pick(file: File) {
    startUpload(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadModuleImageAction(businessId, fd);
      if (res.error || !res.url) {
        toast.error(res.error ?? "ההעלאה נכשלה");
      } else {
        onChange(res.url);
        toast.success("התמונה הועלתה");
      }
    });
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        {value && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt=""
              className="size-12 rounded-lg border object-cover"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(null)}
            >
              <X className="size-4" />
              הסרה
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {value ? "החלפת תמונה" : "העלאת תמונה"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pick(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
