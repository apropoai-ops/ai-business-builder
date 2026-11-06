"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Upload, Plus, Trash2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveDownloadAction,
  deleteDownloadAction,
  uploadDownloadFileAction,
} from "@/lib/actions/downloads";
import { ImageField } from "@/components/business/image-field";
import type { DownloadItem } from "@/types/database";

export function DownloadsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: DownloadItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  function pickFile(file: File) {
    startUpload(async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadDownloadFileAction(businessId, fd);
      if (res.error || !res.storagePath) {
        toast.error(res.error ?? "ההעלאה נכשלה");
      } else {
        setStoragePath(res.storagePath);
        setUploadedName(file.name);
        toast.success("הקובץ הועלה ✓");
      }
    });
  }

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveDownloadAction(businessId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        fileUrl: String(formData.get("fileUrl") ?? ""),
        storagePath,
        price: String(formData.get("price") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הקובץ נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        setStoragePath(null);
        setUploadedName(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteDownloadAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileDown className="size-4 text-primary" />
          קבצים להורדה
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="כותרת" required />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              העלאת קובץ
            </Button>
            {uploadedName ? (
              <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <span className="truncate">{uploadedName}</span>
                <button
                  type="button"
                  onClick={() => {
                    setStoragePath(null);
                    setUploadedName(null);
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">עד 50MB</span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
          </div>
          <Input
            name="fileUrl"
            type="url"
            dir="ltr"
            placeholder={
              storagePath ? "קישור חיצוני (לא נדרש — הועלה קובץ)" : "או קישור לקובץ (https://...)"
            }
            className="sm:col-span-2"
            required={!storagePath}
          />
          <Textarea name="description" placeholder="תיאור (לא חובה)" className="sm:col-span-2" />
          <Input name="price" type="number" min="0" step="0.01" placeholder="מחיר ₪ (השאירו ריק לחינם)" />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף קובץ
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm">
                {d.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.image_url}
                    alt={d.title}
                    className="size-10 rounded-lg object-cover"
                  />
                ) : (
                  <FileDown className="size-4 text-muted-foreground" />
                )}
                <span className="font-semibold">{d.title}</span>
                {d.description && (
                  <span className="text-xs text-muted-foreground">{d.description}</span>
                )}
                <span className="text-xs text-muted-foreground">
                  {d.price != null ? `₪${d.price}` : "חינם"}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {d.storage_path ? "קובץ מועלה" : "קישור חיצוני"}
                </span>
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(d.id)}
                    disabled={busyId === d.id}
                  >
                    {busyId === d.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
