"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Quote, Plus, Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveTestimonialAction,
  deleteTestimonialAction,
} from "@/lib/actions/testimonials";
import { ImageField } from "@/components/business/image-field";
import type { Testimonial } from "@/types/database";

export function TestimonialsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Testimonial[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveTestimonialAction(businessId, {
        author: String(formData.get("author") ?? ""),
        role: String(formData.get("role") ?? ""),
        quote: String(formData.get("quote") ?? ""),
        photoUrl: photoUrl ?? "",
        rating: String(formData.get("rating") ?? ""),
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("ההמלצה נוספה ✓");
        formRef.current?.reset();
        setPhotoUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteTestimonialAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Quote className="size-4 text-primary" />
          ממליצים וסיפורי לקוח
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="author" placeholder="שם הממליץ" required />
          <Input name="role" placeholder="תפקיד / חברה (לא חובה)" />
          <Textarea
            name="quote"
            placeholder="תוכן ההמלצה"
            required
            rows={3}
            className="sm:col-span-2"
          />
          <Input
            name="rating"
            type="number"
            min="1"
            max="5"
            step="1"
            placeholder="דירוג 1-5 (לא חובה)"
          />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={photoUrl}
              onChange={setPhotoUrl}
              label="תמונת הממליץ (לא חובה)"
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף המלצה
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-start gap-2 rounded-lg border p-2.5 text-sm"
              >
                {t.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.photo_url}
                    alt={t.author}
                    loading="lazy"
                    className="size-9 rounded-full object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{t.author}</span>
                    {t.role && (
                      <span className="text-xs text-muted-foreground">{t.role}</span>
                    )}
                    {t.rating != null && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
                        {t.rating}
                        <Star className="size-3.5 fill-current" />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {t.quote}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(t.id)}
                  disabled={busyId === t.id}
                >
                  {busyId === t.id ? (
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
