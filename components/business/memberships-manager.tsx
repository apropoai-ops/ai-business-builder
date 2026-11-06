"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Plus, Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveMembershipAction,
  deleteMembershipAction,
} from "@/lib/actions/memberships";
import { ImageField } from "@/components/business/image-field";
import type { Membership } from "@/types/database";

export function MembershipsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Membership[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [highlight, setHighlight] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveMembershipAction(businessId, {
        name: String(formData.get("name") ?? ""),
        price: String(formData.get("price") ?? ""),
        period: String(formData.get("period") ?? ""),
        perks: String(formData.get("perks") ?? "").split("\n"),
        highlight,
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("המסלול נוסף ✓");
        formRef.current?.reset();
        setHighlight(false);
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteMembershipAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <BadgeCheck className="size-4 text-primary" />
          מסלולי חברות
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="שם המסלול (למשל זהב)" required />
          <div className="flex gap-2">
            <Input
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="מחיר ₪ (לא חובה)"
            />
            <Input name="period" placeholder="תקופה (למשל לחודש)" />
          </div>
          <Textarea
            name="perks"
            placeholder="מה כלול במסלול — שורה לכל הטבה"
            rows={4}
            className="sm:col-span-2"
          />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
              className="size-4"
            />
            סמן כמסלול מומלץ
          </label>
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button
            type="submit"
            disabled={isPending}
            className="gap-1.5 sm:col-span-2 sm:w-fit"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            הוסף מסלול
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {m.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image_url}
                    alt={m.name}
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className="font-bold">{m.name}</span>
                {m.price != null && (
                  <span className="text-muted-foreground">
                    ₪{Number(m.price).toLocaleString("he-IL")}
                    {m.period ? ` ${m.period}` : ""}
                  </span>
                )}
                {m.highlight && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Star className="size-3" />
                    מומלץ
                  </span>
                )}
                {Array.isArray(m.perks) && m.perks.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {m.perks.length} הטבות
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(m.id)}
                    disabled={busyId === m.id}
                  >
                    {busyId === m.id ? (
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
