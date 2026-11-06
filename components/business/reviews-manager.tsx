"use client";

import { useState, useTransition } from "react";
import { Star, Loader2, Check, EyeOff, Trash2, MessageSquareQuote, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  approveReviewAction,
  deleteReviewAction,
  verifyReviewAction,
} from "@/lib/actions/reviews";
import type { Review } from "@/types/database";

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`דירוג ${rating} מתוך 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "size-4",
            i <= rating
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-muted-foreground/40",
          )}
        />
      ))}
    </div>
  );
}

export function ReviewsManager({
  businessId,
  reviews,
}: {
  businessId: string;
  reviews: Review[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const total = reviews.length;
  const approved = reviews.filter((r) => r.approved).length;
  const pending = total - approved;
  const avg =
    total > 0
      ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
      : "—";

  function setApproved(id: string, value: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = await approveReviewAction(businessId, id, value);
      if (res.error) toast.error(res.error);
      else toast.success(value ? "הביקורת פורסמה באתר ✓" : "הביקורת הוסרה מהאתר");
      setBusyId(null);
    });
  }

  function setVerified(id: string, value: boolean) {
    setBusyId(id);
    startTransition(async () => {
      const res = await verifyReviewAction(businessId, id, value);
      if (res.error) toast.error(res.error);
      else toast.success(value ? "סומן כקנייה מאומתת ✓" : "סימון הקנייה המאומתת הוסר");
      setBusyId(null);
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteReviewAction(businessId, id);
      if (res.error) toast.error(res.error);
      else toast.success("הביקורת נמחקה");
      setBusyId(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "סה״כ ביקורות", value: String(total) },
          { label: "מפורסמות", value: String(approved) },
          { label: "ממתינות לאישור", value: String(pending) },
          { label: "דירוג ממוצע", value: avg },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="py-4">
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquareQuote className="size-8 text-muted-foreground/50" />
            <p className="font-medium">אין עדיין ביקורות</p>
            <p className="text-sm text-muted-foreground">
              ביקורות שלקוחות ישאירו באתר שלכם יופיעו כאן לאישור
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((r) => {
            const busy = busyId === r.id;
            return (
              <Card
                key={r.id}
                className={cn(!r.approved && "border-amber-300 bg-amber-50/50")}
              >
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{r.customer_name}</span>
                      <Stars rating={r.rating} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("he-IL", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.verified && (
                        <Badge className="bg-green-600">
                          <BadgeCheck className="me-1 size-3.5" />
                          קנייה מאומתת
                        </Badge>
                      )}
                      {r.approved ? (
                        <Badge className="bg-green-600">מפורסמת</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          ממתינה לאישור
                        </Badge>
                      )}
                    </div>
                  </div>

                  {r.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.image_url}
                      alt={`תמונה מ${r.customer_name}`}
                      loading="lazy"
                      className="max-h-56 w-full max-w-xs rounded-lg border object-cover"
                    />
                  )}

                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {r.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    {r.approved ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setApproved(r.id, false)}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                        הסרה מהאתר
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => setApproved(r.id, true)}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Check className="size-3.5" />
                        )}
                        אישור ופרסום
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setVerified(r.id, !r.verified)}
                      className={cn(
                        r.verified && "border-green-500 text-green-700 hover:text-green-700",
                      )}
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <BadgeCheck className="size-3.5" />
                      )}
                      {r.verified ? "ביטול סימון מאומת" : "סמן כקנייה מאומתת"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => remove(r.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      מחיקה
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
