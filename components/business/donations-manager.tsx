"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveDonationAction,
  deleteDonationAction,
  toggleDonationAction,
} from "@/lib/actions/donations";
import { ImageField } from "@/components/business/image-field";
import type { Donation } from "@/types/database";

export function DonationsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Donation[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveDonationAction(businessId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        goalAmount: String(formData.get("goalAmount") ?? ""),
        raisedAmount: String(formData.get("raisedAmount") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הקמפיין נוצר ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteDonationAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function toggle(d: Donation) {
    setBusyId(d.id);
    startTransition(async () => {
      const res = await toggleDonationAction(businessId, d.id, !d.active);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <HeartHandshake className="size-4 text-primary" />
          קמפיינים לתרומה
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="כותרת הקמפיין" required className="sm:col-span-2" />
          <Textarea
            name="description"
            placeholder="תיאור הקמפיין (לא חובה)"
            className="sm:col-span-2"
          />
          <Input name="goalAmount" type="number" min="0" step="0.01" placeholder="יעד תרומה ₪ (לא חובה)" />
          <Input name="raisedAmount" type="number" min="0" step="0.01" placeholder="נאסף עד כה ₪ (לא חובה)" />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף קמפיין
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((d) => (
              <div
                key={d.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${d.active ? "" : "opacity-55"}`}
              >
                {d.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.image_url}
                    alt={d.title}
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className="font-bold">{d.title}</span>
                {d.goal_amount != null && Number(d.goal_amount) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ₪{Number(d.raised_amount).toLocaleString("he-IL")} מתוך ₪
                    {Number(d.goal_amount).toLocaleString("he-IL")}
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => toggle(d)}
                    disabled={busyId === d.id}
                  >
                    {d.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(d.id)}
                    disabled={busyId === d.id}
                  >
                    {busyId === d.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
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
