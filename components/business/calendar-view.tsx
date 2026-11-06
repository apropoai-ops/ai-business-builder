"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Camera,
  Users,
  Briefcase,
  Music2,
  FileText,
  Mail,
  Circle,
  CheckCircle2,
  Trash2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarWatcher } from "@/components/business/calendar-watcher";
import {
  toggleCalendarEntryAction,
  deleteCalendarEntryAction,
} from "@/lib/actions/content-calendar";
import type { CalendarEntry } from "@/types/database";
import {
  platformLabels,
  calendarPeriodLabels,
  type CalendarPeriod,
} from "@/lib/ai/schemas/content-calendar";

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  instagram: Camera,
  facebook: Users,
  linkedin: Briefcase,
  tiktok: Music2,
  blog: FileText,
  email: Mail,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-100 text-pink-700",
  facebook: "bg-blue-100 text-blue-700",
  linkedin: "bg-sky-100 text-sky-700",
  tiktok: "bg-zinc-200 text-zinc-800",
  blog: "bg-green-100 text-green-700",
  email: "bg-orange-100 text-orange-700",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  post: "פוסט",
  reel: "ריל",
  story: "סטורי",
  article: "כתבה",
  newsletter: "ניוזלטר",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

function EntryRow({
  entry,
  businessId,
}: {
  entry: CalendarEntry;
  businessId: string;
}) {
  const [isPending, start] = useTransition();
  const Icon = PLATFORM_ICONS[entry.platform] ?? FileText;
  const color = PLATFORM_COLORS[entry.platform] ?? "bg-gray-100 text-gray-700";
  const published = entry.status === "published";

  function toggle() {
    start(async () => {
      await toggleCalendarEntryAction(
        businessId,
        entry.id,
        published ? "planned" : "published",
      );
    });
  }

  function remove() {
    start(async () => {
      await deleteCalendarEntryAction(businessId, entry.id);
      toast.success("הפריט נמחק");
    });
  }

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${published ? "opacity-60" : ""}`}
    >
      <button
        onClick={toggle}
        disabled={isPending}
        className="mt-0.5 text-muted-foreground hover:text-primary"
        title={published ? "סמן כמתוכנן" : "סמן כפורסם"}
      >
        {published ? (
          <CheckCircle2 className="size-5 text-primary" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>

      <span
        className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${color}`}
      >
        <Icon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium ${published ? "line-through" : ""}`}>
            {entry.title}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {platformLabels[entry.platform] ?? entry.platform}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {CONTENT_TYPE_LABELS[entry.content_type] ?? entry.content_type}
          </Badge>
        </div>
        {entry.idea && (
          <p className="mt-1 text-xs text-muted-foreground">{entry.idea}</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={remove}
        disabled={isPending}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

export function CalendarView({
  businessId,
  entries,
  isGenerating,
}: {
  businessId: string;
  entries: CalendarEntry[];
  isGenerating: boolean;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<CalendarPeriod>("month");
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const res = await fetch(`/api/businesses/${businessId}/calendar/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (res.ok) {
        toast.success("לוח התוכן נבנה ✓");
        // The job runs synchronously inside the request, so it's already
        // terminal here — refresh directly instead of relying on the watcher.
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error || "שגיאה בהפעלת הייצור — נסה שוב");
      }
    });
  }

  const generating = isGenerating || isPending;

  // Group entries by date.
  const grouped = entries.reduce<Record<string, CalendarEntry[]>>((acc, e) => {
    (acc[e.scheduled_for] ??= []).push(e);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm font-medium">תקופת התכנון</label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as CalendarPeriod)}
              disabled={generating}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(calendarPeriodLabels) as CalendarPeriod[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {calendarPeriodLabels[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleGenerate} disabled={generating} className="gap-2">
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating ? "בונה..." : entries.length > 0 ? "בנה מחדש" : "בנה לוח תוכן"}
          </Button>
        </CardContent>
      </Card>

      {generating && <CalendarWatcher businessId={businessId} />}

      {!generating && entries.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          בחר תקופה ולחץ על &quot;בנה לוח תוכן&quot; כדי שה-AI יתכנן עבורך לוח פרסום
          מלא.
        </p>
      )}

      {!generating && dates.length > 0 && (
        <div className="flex flex-col gap-5">
          {dates.map((date) => (
            <div key={date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80">
                <CalendarDays className="size-4 text-primary" />
                {formatDate(date)}
              </div>
              <div className="flex flex-col gap-2">
                {grouped[date].map((entry) => (
                  <EntryRow key={entry.id} entry={entry} businessId={businessId} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
