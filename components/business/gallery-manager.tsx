"use client";

import { useRef, useState, useTransition } from "react";
import { Image as ImageIcon, ImagePlus, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveGalleryItemAction,
  deleteGalleryItemAction,
} from "@/lib/actions/gallery";
import { uploadModuleImageAction } from "@/lib/actions/module-image";
import { ImageField } from "@/components/business/image-field";
import type { GalleryItem } from "@/types/database";

export function GalleryManager({
  businessId,
  items,
}: {
  businessId: string;
  items: GalleryItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isBulkUploading, startBulkUpload] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function add(formData: FormData) {
    if (!imageUrl) {
      toast.error("נא להעלות תמונה");
      return;
    }
    startTransition(async () => {
      const res = await saveGalleryItemAction(businessId, {
        imageUrl,
        title: String(formData.get("title") ?? ""),
        caption: String(formData.get("caption") ?? ""),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("התמונה נוספה ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  /** Bulk path: upload N files and create a gallery item per file (no title/caption). */
  function addMany(files: FileList) {
    const picked = Array.from(files);
    startBulkUpload(async () => {
      let added = 0;
      for (const file of picked) {
        const fd = new FormData();
        fd.append("file", file);
        const up = await uploadModuleImageAction(businessId, fd);
        if (up.error || !up.url) {
          toast.error(up.error ?? "ההעלאה נכשלה");
          break;
        }
        const res = await saveGalleryItemAction(businessId, { imageUrl: up.url });
        if (res.error) {
          toast.error(res.error);
          break;
        }
        added++;
      }
      if (added > 0) {
        toast.success(added === 1 ? "התמונה נוספה ✓" : `${added} תמונות נוספו ✓`);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteGalleryItemAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          <ImageIcon className="size-4 text-primary" />
          גלריית תמונות
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ms-auto gap-1.5 font-normal"
            disabled={isBulkUploading}
            onClick={() => bulkRef.current?.click()}
          >
            {isBulkUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ImagePlus className="size-4" />
            )}
            העלאת כמה תמונות
          </Button>
          <input
            ref={bulkRef}
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) addMany(files);
              e.target.value = "";
            }}
          />
        </div>

        <form ref={formRef} action={add} className="grid gap-2">
          <ImageField
            businessId={businessId}
            value={imageUrl}
            onChange={setImageUrl}
            label="תמונה (חובה)"
          />
          <Input name="title" placeholder="כותרת (לא חובה)" />
          <Textarea name="caption" placeholder="תיאור (לא חובה)" rows={2} />
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:w-fit">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            הוסף תמונה
          </Button>
        </form>

        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="group relative overflow-hidden rounded-xl border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.image_url}
                  alt={it.title ?? "תמונת גלריה"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
                {(it.title || it.caption) && (
                  <div className="px-2 py-1.5">
                    {it.title && (
                      <p className="truncate text-xs font-semibold">{it.title}</p>
                    )}
                    {it.caption && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {it.caption}
                      </p>
                    )}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute end-1 top-1 size-7 bg-white/90 text-muted-foreground shadow-sm hover:text-destructive"
                  onClick={() => remove(it.id)}
                  disabled={busyId === it.id}
                >
                  {busyId === it.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
