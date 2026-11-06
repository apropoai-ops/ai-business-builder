"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Newspaper, Plus, Pencil, Trash2, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageField } from "@/components/business/image-field";
import {
  saveBlogPostAction,
  deleteBlogPostAction,
  togglePublishAction,
} from "@/lib/actions/blog";
import type { BlogPost } from "@/types/database";

export function BlogManager({
  businessId,
  items,
}: {
  businessId: string;
  items: BlogPost[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // editId === "new" for the add form; a row id when editing that row.
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  function openNew() {
    setEditId("new");
    setTitle("");
    setExcerpt("");
    setBody("");
    setCoverUrl(null);
    setPublished(false);
  }

  function openEdit(p: BlogPost) {
    setEditId(p.id);
    setTitle(p.title);
    setExcerpt(p.excerpt ?? "");
    setBody(p.body ?? "");
    setCoverUrl(p.cover_url);
    setPublished(p.published);
  }

  function cancel() {
    setEditId(null);
    setTitle("");
    setExcerpt("");
    setBody("");
    setCoverUrl(null);
    setPublished(false);
  }

  function save() {
    if (!title.trim()) {
      toast.error("נא להזין כותרת");
      return;
    }
    startTransition(async () => {
      const res = await saveBlogPostAction(businessId, {
        id: editId && editId !== "new" ? editId : undefined,
        title,
        excerpt,
        body,
        coverUrl: coverUrl ?? "",
        published,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editId === "new" ? "המאמר נוסף ✓" : "המאמר עודכן ✓");
      cancel();
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteBlogPostAction(businessId, id);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  function toggle(p: BlogPost) {
    setBusyId(p.id);
    startTransition(async () => {
      const res = await togglePublishAction(businessId, p.id, !p.published);
      if (res.error) toast.error(res.error);
      else router.refresh();
      setBusyId(null);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Newspaper className="size-4 text-primary" />
            בלוג ומאמרים
          </div>
          {editId === null && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
              <Plus className="size-4" />
              הוסף מאמר
            </Button>
          )}
        </div>

        {editId === "new" && (
          <BlogForm
            businessId={businessId}
            title={title}
            excerpt={excerpt}
            body={body}
            coverUrl={coverUrl}
            published={published}
            onTitle={setTitle}
            onExcerpt={setExcerpt}
            onBody={setBody}
            onCoverUrl={setCoverUrl}
            onPublished={setPublished}
            onSave={save}
            onCancel={cancel}
            isPending={isPending}
          />
        )}

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((p) =>
              editId === p.id ? (
                <BlogForm
                  key={p.id}
                  businessId={businessId}
                  title={title}
                  excerpt={excerpt}
                  body={body}
                  coverUrl={coverUrl}
                  published={published}
                  onTitle={setTitle}
                  onExcerpt={setExcerpt}
                  onBody={setBody}
                  onCoverUrl={setCoverUrl}
                  onPublished={setPublished}
                  onSave={save}
                  onCancel={cancel}
                  isPending={isPending}
                />
              ) : (
                <div
                  key={p.id}
                  className={`flex flex-wrap items-center gap-2 rounded-lg border p-2.5 text-sm ${p.published ? "" : "opacity-55"}`}
                >
                  {p.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.cover_url}
                      alt=""
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="font-bold">{p.title}</span>
                  {p.published && p.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(p.published_at).toLocaleDateString("he-IL")}
                    </span>
                  )}
                  {!p.published && (
                    <span className="text-xs text-muted-foreground">טיוטה</span>
                  )}
                  <div className="ms-auto flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(p)}
                      disabled={isPending}
                      title="עריכה"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => toggle(p)}
                      disabled={busyId === p.id}
                      title={p.published ? "הסתר" : "פרסם"}
                    >
                      {p.published ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(p.id)}
                      disabled={busyId === p.id}
                    >
                      {busyId === p.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          editId === null && (
            <p className="text-sm text-muted-foreground">
              עדיין לא הוספת מאמרים לבלוג.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

function BlogForm({
  businessId,
  title,
  excerpt,
  body,
  coverUrl,
  published,
  onTitle,
  onExcerpt,
  onBody,
  onCoverUrl,
  onPublished,
  onSave,
  onCancel,
  isPending,
}: {
  businessId: string;
  title: string;
  excerpt: string;
  body: string;
  coverUrl: string | null;
  published: boolean;
  onTitle: (v: string) => void;
  onExcerpt: (v: string) => void;
  onBody: (v: string) => void;
  onCoverUrl: (v: string | null) => void;
  onPublished: (v: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      <Input
        placeholder="כותרת המאמר (חובה)"
        value={title}
        onChange={(e) => onTitle(e.target.value)}
      />
      <Input
        placeholder="תקציר קצר (לא חובה — מוצג בכרטיס ובתוצאות החיפוש)"
        value={excerpt}
        onChange={(e) => onExcerpt(e.target.value)}
      />
      <div className="space-y-1">
        <Textarea
          placeholder="תוכן המאמר (לא חובה)"
          value={body}
          onChange={(e) => onBody(e.target.value)}
          rows={10}
        />
        <p className="text-xs text-muted-foreground">
          טיפ: שורה ריקה בין פסקאות תיצור פסקה חדשה באתר הציבורי, ושורה בודדת תישמר כירידת שורה.
        </p>
      </div>
      <ImageField
        businessId={businessId}
        value={coverUrl}
        onChange={onCoverUrl}
        label="תמונת כותרת (אופציונלי)"
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => onPublished(e.target.checked)}
          className="size-4"
        />
        פרסם באתר
      </label>
      <div className="flex items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={onSave} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          שמירה
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onCancel} disabled={isPending}>
          <X className="size-4" />
          ביטול
        </Button>
      </div>
    </div>
  );
}
