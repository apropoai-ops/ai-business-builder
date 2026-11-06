"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Users,
  Briefcase,
  Video,
  FileText,
  Mail,
  Copy,
  Check,
  Download,
  Trash2,
  Loader2,
  Sparkles,
  Search,
  SearchX,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ContentWatcher } from "@/components/business/content-watcher";
import { deleteContentItemAction } from "@/lib/actions/content";
import type { ContentItem } from "@/types/database";
import { contentTypeLabels, type ContentType } from "@/lib/ai/schemas/content";

const TYPE_ICONS: Record<ContentType, React.ElementType> = {
  instagram_post: Camera,
  facebook_post: Users,
  linkedin_post: Briefcase,
  reel_script: Video,
  blog_article: FileText,
  email_newsletter: Mail,
};

const TYPE_COLORS: Record<ContentType, string> = {
  instagram_post: "bg-pink-100 text-pink-700",
  facebook_post: "bg-blue-100 text-blue-700",
  linkedin_post: "bg-sky-100 text-sky-700",
  reel_script: "bg-purple-100 text-purple-700",
  blog_article: "bg-green-100 text-green-700",
  email_newsletter: "bg-orange-100 text-orange-700",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("הועתק ללוח");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("ההעתקה נכשלה — נסה שוב");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 px-2"
      aria-label="העתקה"
      title="העתקה"
    >
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned || "תוכן";
}

function DownloadButton({ text, filename }: { text: string; filename: string }) {
  function handleDownload() {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${sanitizeFilename(filename)}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      className="h-7 px-2"
      aria-label="הורדה"
      title="הורדה"
    >
      <Download className="size-3.5" />
    </Button>
  );
}

function ContentCard({
  item,
  businessId,
}: {
  item: ContentItem;
  businessId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const Icon = TYPE_ICONS[item.type as ContentType] ?? FileText;
  const colorClass = TYPE_COLORS[item.type as ContentType] ?? "bg-gray-100 text-gray-700";
  const label = contentTypeLabels[item.type as ContentType] ?? item.type;
  const hashtags = Array.isArray(item.hashtags) ? (item.hashtags as string[]) : [];

  const fullText = [
    item.title ? `${item.title}\n\n` : "",
    item.content,
    hashtags.length ? `\n\n${hashtags.map((h) => `#${h}`).join(" ")}` : "",
    item.cta ? `\n\n${item.cta}` : "",
  ].join("");

  function handleDelete() {
    startTransition(async () => {
      await deleteContentItemAction(businessId, item.id);
      toast.success("הפריט נמחק");
    });
  }

  return (
    <Card className="flex flex-col gap-0">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-2">
          <span className={`flex size-7 items-center justify-center rounded-lg ${colorClass}`}>
            <Icon className="size-4" />
          </span>
          <div>
            <Badge variant="secondary" className={`text-xs ${colorClass} border-0`}>
              {label}
            </Badge>
            {item.topic && (
              <p className="mt-0.5 text-xs text-muted-foreground">נושא: {item.topic}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <CopyButton text={fullText} />
          <DownloadButton text={fullText} filename={item.title ?? label} />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        {item.title && (
          <p className="font-semibold leading-snug">{item.title}</p>
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {item.content}
        </p>
        {hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span key={tag} className="text-xs text-primary/80">
                #{tag}
              </span>
            ))}
          </div>
        )}
        {item.cta && (
          <p className="text-sm font-medium text-primary">{item.cta}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ContentView({
  businessId,
  items,
  isGenerating,
}: {
  businessId: string;
  items: ContentItem[];
  isGenerating: boolean;
}) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [isPending, startTransition] = useTransition();
  const [typeFilter, setTypeFilter] = useState<ContentType | "all">("all");
  const [search, setSearch] = useState("");

  const availableTypes = useMemo(() => {
    const seen = new Set<string>();
    const types: ContentType[] = [];
    for (const item of items) {
      if (!seen.has(item.type)) {
        seen.add(item.type);
        types.push(item.type as ContentType);
      }
    }
    return types;
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!query) return true;
      return (
        (item.title ?? "").toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      );
    });
  }, [items, typeFilter, search]);

  function handleGenerate() {
    if (!topic.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/businesses/${businessId}/content/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (res.ok) {
        setTopic("");
        toast.success("התוכן נוצר ✓");
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

  return (
    <div className="flex flex-col gap-6">
      {/* Generate bar */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-sm font-medium">נושא התוכן</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder='למשל: "טיפים לחיסכון בעסק קטן", "השקת מוצר חדש"...'
              disabled={generating}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            />
          </div>
          <Button onClick={handleGenerate} disabled={generating || !topic.trim()} className="gap-2">
            {generating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {generating ? "מייצר..." : "צור תוכן"}
          </Button>
        </CardContent>
      </Card>

      {/* Watcher while generating */}
      {generating && <ContentWatcher businessId={businessId} />}

      {/* Content grid */}
      {!generating && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          הכנס נושא ולחץ על &quot;צור תוכן&quot; כדי לייצר 6 פיסות תוכן לפלטפורמות שונות.
        </p>
      )}

      {items.length > 0 && (
        <>
          {/* Filter + search bar */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={typeFilter === "all" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8"
                  onClick={() => setTypeFilter("all")}
                >
                  הכל
                </Button>
                {availableTypes.map((type) => (
                  <Button
                    key={type}
                    variant={typeFilter === type ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8"
                    onClick={() => setTypeFilter(type)}
                  >
                    {contentTypeLabels[type] ?? type}
                  </Button>
                ))}
              </div>
              <div className="relative sm:ms-auto sm:w-64">
                <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="חיפוש בכותרת או בתוכן..."
                  className="ps-8"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              מציג {filteredItems.length} מתוך {items.length} פריטים
            </p>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <SearchX className="size-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                לא נמצאו פריטים התואמים את הסינון. נסו לשנות את החיפוש או לבחור סוג תוכן אחר.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setTypeFilter("all");
                }}
              >
                ניקוי סינון
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <ContentCard key={item.id} item={item} businessId={businessId} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
