"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Plus, Pencil, Trash2, Loader2, X, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveFaqAction, deleteFaqAction } from "@/lib/actions/faqs";
import { ImageField } from "@/components/business/image-field";
import type { Faq } from "@/types/database";

export function FaqsManager({
  businessId,
  items,
}: {
  businessId: string;
  items: Faq[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  // editId === "new" for the add form; a row id when editing that row.
  const [editId, setEditId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  function openNew() {
    setEditId("new");
    setQuestion("");
    setAnswer("");
    setImageUrl(null);
  }

  function openEdit(f: Faq) {
    setEditId(f.id);
    setQuestion(f.question);
    setAnswer(f.answer ?? "");
    setImageUrl(f.image_url ?? null);
  }

  function cancel() {
    setEditId(null);
    setQuestion("");
    setAnswer("");
    setImageUrl(null);
  }

  function save() {
    if (!question.trim()) {
      toast.error("נא להזין שאלה");
      return;
    }
    startTransition(async () => {
      const res = await saveFaqAction(businessId, {
        id: editId && editId !== "new" ? editId : undefined,
        question,
        answer,
        imageUrl,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(editId === "new" ? "השאלה נוספה ✓" : "השאלה עודכנה ✓");
      cancel();
      router.refresh();
    });
  }

  function remove(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await deleteFaqAction(businessId, id);
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
            <HelpCircle className="size-4 text-primary" />
            שאלות נפוצות
          </div>
          {editId === null && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
              <Plus className="size-4" />
              הוסף שאלה
            </Button>
          )}
        </div>

        {editId === "new" && (
          <FaqForm
            businessId={businessId}
            question={question}
            answer={answer}
            imageUrl={imageUrl}
            onQuestion={setQuestion}
            onAnswer={setAnswer}
            onImageUrl={setImageUrl}
            onSave={save}
            onCancel={cancel}
            isPending={isPending}
          />
        )}

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((f) =>
              editId === f.id ? (
                <FaqForm
                  key={f.id}
                  businessId={businessId}
                  question={question}
                  answer={answer}
                  imageUrl={imageUrl}
                  onQuestion={setQuestion}
                  onAnswer={setAnswer}
                  onImageUrl={setImageUrl}
                  onSave={save}
                  onCancel={cancel}
                  isPending={isPending}
                />
              ) : (
                <div
                  key={f.id}
                  className="flex items-start gap-2 rounded-lg border p-2.5 text-sm"
                >
                  {f.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.image_url}
                      alt={f.question}
                      className="size-10 shrink-0 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{f.question}</p>
                    {f.answer && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                        {f.answer}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => openEdit(f)}
                      disabled={isPending}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(f.id)}
                      disabled={busyId === f.id}
                    >
                      {busyId === f.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          editId === null && (
            <p className="text-sm text-muted-foreground">
              עדיין לא הוספת שאלות נפוצות.
            </p>
          )
        )}
      </CardContent>
    </Card>
  );
}

function FaqForm({
  businessId,
  question,
  answer,
  imageUrl,
  onQuestion,
  onAnswer,
  onImageUrl,
  onSave,
  onCancel,
  isPending,
}: {
  businessId: string;
  question: string;
  answer: string;
  imageUrl: string | null;
  onQuestion: (v: string) => void;
  onAnswer: (v: string) => void;
  onImageUrl: (v: string | null) => void;
  onSave: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-2.5">
      <Input
        placeholder="שאלה (חובה)"
        value={question}
        onChange={(e) => onQuestion(e.target.value)}
      />
      <Textarea
        placeholder="תשובה (לא חובה)"
        value={answer}
        onChange={(e) => onAnswer(e.target.value)}
      />
      <ImageField businessId={businessId} value={imageUrl} onChange={onImageUrl} />
      <div className="flex items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={onSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
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
