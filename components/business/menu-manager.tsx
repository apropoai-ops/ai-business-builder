"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UtensilsCrossed, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveMenuItemAction,
  deleteMenuItemAction,
} from "@/lib/actions/menu";
import { ImageField } from "@/components/business/image-field";
import type { MenuItem } from "@/types/database";

export function MenuManager({
  businessId,
  items,
}: {
  businessId: string;
  items: MenuItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Group items by section (preserving the order they arrive in).
  const groups: { section: string | null; items: MenuItem[] }[] = [];
  for (const item of items) {
    const key = item.section ?? null;
    let group = groups.find((g) => g.section === key);
    if (!group) {
      group = { section: key, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveMenuItemAction(businessId, {
        section: String(formData.get("section") ?? ""),
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        price: String(formData.get("price") ?? ""),
        imageUrl: imageUrl ?? "",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הפריט נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteMenuItemAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UtensilsCrossed className="size-4 text-primary" />
          תפריט
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="section" placeholder="קטגוריה (למשל ראשונות)" />
          <Input name="name" placeholder="שם הפריט" required />
          <Input name="price" type="number" min="0" step="0.01" placeholder="מחיר ₪ (לא חובה)" />
          <Textarea
            name="description"
            placeholder="תיאור (לא חובה)"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
              label="תמונת המנה (לא חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף פריט
          </Button>
        </form>

        {groups.length > 0 && (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.section ?? "__none__"} className="space-y-2">
                {group.section && (
                  <div className="text-xs font-semibold text-muted-foreground">
                    {group.section}
                  </div>
                )}
                {group.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
                  >
                    {item.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.name}
                        loading="lazy"
                        className="size-10 rounded object-cover"
                      />
                    )}
                    <span className="font-semibold">{item.name}</span>
                    {item.price != null && (
                      <span className="text-xs text-muted-foreground">
                        ₪{Number(item.price).toLocaleString("he-IL")}
                      </span>
                    )}
                    {item.description && (
                      <span className="w-full text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    )}
                    <div className="ms-auto flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(item.id)}
                        disabled={busyId === item.id}
                      >
                        {busyId === item.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
