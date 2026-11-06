"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  saveCertificationAction,
  deleteCertificationAction,
} from "@/lib/actions/certifications";
import { ImageField } from "@/components/business/image-field";
import type { Certification } from "@/types/database";

export function CertificationsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Certification[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveCertificationAction(businessId, {
        title: String(formData.get("title") ?? ""),
        issuer: String(formData.get("issuer") ?? ""),
        year: String(formData.get("year") ?? ""),
        imageUrl: imageUrl ?? "",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("התעודה נוספה ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteCertificationAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Award className="size-4 text-primary" />
          תעודות והסמכות
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="שם התעודה (חובה)" required />
          <Input name="issuer" placeholder="גורם מנפיק (לא חובה)" />
          <Input name="year" placeholder="שנה (לא חובה)" />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
              label="תמונת התעודה (לא חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף תעודה
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.title}
                    className="size-9 rounded object-contain"
                  />
                ) : (
                  <Award className="size-5 text-muted-foreground" />
                )}
                <span className="font-bold">{c.title}</span>
                {c.issuer && (
                  <span className="text-xs text-muted-foreground">{c.issuer}</span>
                )}
                {c.year && (
                  <span className="text-xs text-muted-foreground">· {c.year}</span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="ms-auto size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(c.id)}
                  disabled={busyId === c.id}
                >
                  {busyId === c.id ? (
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
