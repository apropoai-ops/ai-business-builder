"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { GalleryUpload } from "@/components/business/gallery-upload";
import { uploadGalleryImagesAction, deleteGalleryImageAction } from "@/lib/actions/business-gallery";

/**
 * General photo gallery — of the business itself, or of products before any
 * product record exists yet. Not tied to the wizard: this is where an owner
 * of an EXISTING business reaches the same capability (lib/actions/gallery.ts).
 */
export function BusinessGalleryCard({
  businessId,
  images,
}: {
  businessId: string;
  images: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleUpload(files: File[]) {
    setBusy(true);
    const fd = new FormData();
    for (const file of files) fd.append("images", file);
    const res = await uploadGalleryImagesAction(businessId, fd);
    if (res.error) toast.error(res.error);
    else {
      toast.success(files.length > 1 ? "התמונות הועלו ✓" : "התמונה הועלתה ✓");
      router.refresh();
    }
    setBusy(false);
  }

  async function handleRemove(url: string) {
    setBusy(true);
    const res = await deleteGalleryImageAction(businessId, url);
    if (res.error) toast.error(res.error);
    else router.refresh();
    setBusy(false);
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="text-sm font-semibold">גלריית תמונות</div>
        <p className="text-[11px] text-muted-foreground">
          תמונות כלליות של העסק והמוצרים — למי שעדיין אין רשומות מוצר מוגדרות, או סתם רוצה להראות את העסק.
        </p>
        <GalleryUpload
          previews={images.map((url) => ({ key: url, src: url }))}
          onFilesSelected={handleUpload}
          onRemove={handleRemove}
          busy={busy}
        />
      </CardContent>
    </Card>
  );
}
