"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Plus,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  MapPin,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  saveEventAction,
  deleteEventAction,
  toggleEventAction,
} from "@/lib/actions/events";
import { ImageField } from "@/components/business/image-field";
import type { EventItem } from "@/types/database";

const dateFmt = new Intl.DateTimeFormat("he-IL", {
  // Without this, an owner in the browser reads Israel time while the value
  // stored/rendered elsewhere (this ran in the server's UTC clock) disagreed
  // by 2-3 hours. See lib/actions/events.ts for the write-side half of the fix.
  timeZone: "Asia/Jerusalem",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function EventsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: EventItem[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function create(formData: FormData) {
    startTransition(async () => {
      const res = await saveEventAction(businessId, {
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        startsAt: String(formData.get("startsAt") ?? ""),
        location: String(formData.get("location") ?? ""),
        capacity: String(formData.get("capacity") ?? ""),
        imageUrl,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success("האירוע נשמר ✓");
        formRef.current?.reset();
        setImageUrl(null);
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteEventAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function toggle(e: EventItem) {
    setBusyId(e.id);
    startTransition(async () => {
      const res = await toggleEventAction(businessId, e.id, !e.active);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="size-4 text-primary" />
          אירועים וחוגים
        </div>

        <form ref={formRef} action={create} className="grid gap-2 sm:grid-cols-2">
          <Input name="title" placeholder="שם האירוע" required className="sm:col-span-2" />
          <Textarea
            name="description"
            placeholder="תיאור (לא חובה)"
            className="sm:col-span-2"
          />
          <Input name="startsAt" type="datetime-local" placeholder="מתי" />
          <Input name="location" placeholder="מיקום (לא חובה)" />
          <Input
            name="capacity"
            type="number"
            min="1"
            step="1"
            placeholder="מספר משתתפים מרבי (לא חובה)"
            className="sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <ImageField
              businessId={businessId}
              value={imageUrl}
              onChange={setImageUrl}
            />
          </div>
          <Button type="submit" disabled={isPending} className="gap-1.5 sm:col-span-2 sm:w-fit">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף אירוע
          </Button>
        </form>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((e) => (
              <div
                key={e.id}
                className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${e.active ? "" : "opacity-55"}`}
              >
                {e.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e.title}
                    className="size-10 rounded object-cover"
                  />
                )}
                <span className="font-bold">{e.title}</span>
                {e.starts_at && (
                  <span className="text-xs text-muted-foreground">
                    {dateFmt.format(new Date(e.starts_at))}
                  </span>
                )}
                {e.location && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" />
                    {e.location}
                  </span>
                )}
                {e.capacity != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" />
                    {e.capacity}
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => toggle(e)}
                    disabled={busyId === e.id}
                  >
                    {e.active ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(e.id)}
                    disabled={busyId === e.id}
                  >
                    {busyId === e.id ? (
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
