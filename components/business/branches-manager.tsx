"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2, Loader2, Phone, Clock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveBranchAction, deleteBranchAction } from "@/lib/actions/branches";
import { ImageField } from "@/components/business/image-field";
import type { Branch } from "@/types/database";

export function BranchesManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Branch[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveBranchAction(businessId, {
        name: String(formData.get("name") ?? ""),
        address: String(formData.get("address") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        hours: String(formData.get("hours") ?? ""),
        mapUrl: String(formData.get("mapUrl") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הסניף נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteBranchAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-primary" />
          סניפים
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="שם הסניף (למשל סניף תל אביב)" required />
          <Input name="phone" type="tel" dir="ltr" placeholder="טלפון (לא חובה)" />
          <Input name="address" placeholder="כתובת (לא חובה)" className="sm:col-span-2" />
          <Input name="hours" placeholder="שעות פעילות (לא חובה)" className="sm:col-span-2" />
          <Textarea name="mapUrl" dir="ltr" rows={2} placeholder="קישור לניווט / מפה (לא חובה)" className="sm:col-span-2" />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף סניף
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((b) => (
              <div key={b.id} className="flex flex-wrap items-start gap-2 rounded-lg border p-2.5 text-sm">
                {b.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.image_url}
                    alt={b.name}
                    className="size-10 shrink-0 rounded object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <span className="font-bold">{b.name}</span>
                  {b.address && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 shrink-0" />
                      {b.address}
                    </div>
                  )}
                  {b.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
                      <Phone className="size-3.5 shrink-0" />
                      {b.phone}
                    </div>
                  )}
                  {b.hours && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="size-3.5 shrink-0" />
                      {b.hours}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(b.id)}
                  disabled={busyId === b.id}
                >
                  {busyId === b.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
