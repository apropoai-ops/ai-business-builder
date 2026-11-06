"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, Trash2, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveCourseAction,
  deleteCourseAction,
  toggleCourseAction,
} from "@/lib/actions/courses";
import { ImageField } from "@/components/business/image-field";
import type { Course } from "@/types/database";

export function CoursesManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Course[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveCourseAction(businessId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        price: String(formData.get("price") ?? ""),
        level: String(formData.get("level") ?? ""),
        duration: String(formData.get("duration") ?? ""),
        imageUrl: imageUrl ?? "",
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("הקורס נוסף ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteCourseAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function toggle(id: string, active: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = await toggleCourseAction(businessId, id, active);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <GraduationCap className="size-4 text-primary" />
          קורסים
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="שם הקורס" required />
          <Input name="price" type="number" min="0" step="0.01" placeholder="מחיר ₪ (לא חובה)" />
          <Input name="level" placeholder="רמה (למשל מתחילים)" />
          <Input name="duration" placeholder="משך (למשל 6 שבועות)" />
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
              label="תמונת הקורס (לא חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף קורס
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm"
              >
                {item.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className={`font-semibold ${item.active ? "" : "text-muted-foreground line-through"}`}>
                  {item.title}
                </span>
                {item.level && (
                  <span className="text-xs text-muted-foreground">{item.level}</span>
                )}
                {item.duration && (
                  <span className="text-xs text-muted-foreground">· {item.duration}</span>
                )}
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
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => toggle(item.id, !item.active)}
                    disabled={busyId === item.id}
                    title={item.active ? "הסתר" : "הצג"}
                  >
                    {busyId === item.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : item.active ? (
                      <Eye className="size-3.5" />
                    ) : (
                      <EyeOff className="size-3.5" />
                    )}
                  </Button>
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
        )}
      </CardContent>
    </Card>
  );
}
