"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, Trash2, Loader2, Eye, EyeOff, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveJobAction,
  deleteJobAction,
  toggleJobAction,
} from "@/lib/actions/jobs";
import { ImageField } from "@/components/business/image-field";
import type { JobOpening } from "@/types/database";

export function JobsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: JobOpening[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveJobAction(businessId, {
        title: String(formData.get("title") ?? ""),
        location: String(formData.get("location") ?? ""),
        employmentType: String(formData.get("employmentType") ?? ""),
        description: String(formData.get("description") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("המשרה נוספה ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteJobAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function toggle(j: JobOpening) {
    setBusyId(j.id);
    startTransition(async () => {
      const res = await toggleJobAction(businessId, j.id, !j.active);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="size-4 text-primary" />
          דרושים — משרות פתוחות
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="כותרת המשרה (למשל מלצר/ית)" required className="sm:col-span-2" />
          <Input name="location" placeholder="מיקום (לא חובה)" />
          <Input name="employmentType" placeholder="היקף משרה — למשל משרה מלאה (לא חובה)" />
          <Textarea name="description" placeholder="תיאור המשרה (לא חובה)" className="sm:col-span-2" rows={3} />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף משרה
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((j) => (
              <div
                key={j.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${j.active ? "" : "opacity-55"}`}
              >
                {j.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={j.image_url}
                    alt={j.title}
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className="font-bold">{j.title}</span>
                {j.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {j.location}
                  </span>
                )}
                {j.employment_type && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {j.employment_type}
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => toggle(j)} disabled={busyId === j.id}>
                    {j.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(j.id)}
                    disabled={busyId === j.id}
                  >
                    {busyId === j.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
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
