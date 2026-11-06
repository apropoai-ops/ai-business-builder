"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, Unlink, ExternalLink, Receipt, MessageSquareText, Plug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { IntegrationCard, StatusBadge } from "@/components/business/integrations/integration-card";
import { saveIntegrationAction, disconnectIntegrationAction } from "@/lib/actions/integrations";
import type { IntegrationCategory } from "@/lib/services/integrations/credentials";

export type ProviderField = {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  placeholder?: string;
  help?: string;
};

export type ProviderMeta = {
  id: string;
  name: string;
  description?: string;
  docsUrl?: string;
  fields: ProviderField[];
};

/**
 * Generic "connect one of several providers" card — shared by the חשבוניות
 * and SMS sections. Credentials are write-only: the form always starts
 * blank, even for an already-connected provider, since the server never
 * returns stored secrets back to the client. On edit, fields left blank keep
 * their previously-saved value (the server merges rather than replaces —
 * see saveIntegrationCredentials), so only new/changed fields are required.
 */
/**
 * Icons are resolved locally by category — component functions (and Sets)
 * cannot cross the server→client props boundary, so the server sections pass
 * only plain data.
 */
const CATEGORY_ICONS = {
  invoicing: Receipt,
  sms: MessageSquareText,
  other: Plug,
} as const;

export function ProviderConnectCard({
  businessId,
  category,
  title,
  subtitle,
  providers,
  connectedProviders,
  children,
}: {
  businessId: string;
  category: IntegrationCategory;
  title: string;
  subtitle: string;
  providers: ProviderMeta[];
  connectedProviders: string[];
  /** Extra explanatory content rendered below the provider list. */
  children?: React.ReactNode;
}) {
  const icon = CATEGORY_ICONS[category] ?? Plug;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const editing = providers.find((p) => p.id === editingId) ?? null;
  const editingConnected = editing ? connectedProviders.includes(editing.id) : false;

  function openForm(id: string) {
    setEditingId(id);
    setForm({});
  }

  function closeForm() {
    setEditingId(null);
    setForm({});
  }

  function save() {
    if (!editing) return;
    setBusyProvider(editing.id);
    startTransition(async () => {
      const res = await saveIntegrationAction(businessId, editing.id, category, form);
      setBusyProvider(null);
      if (!res.ok) {
        toast.error(res.error ?? "השמירה נכשלה");
        return;
      }
      toast.success("החיבור נשמר ✓");
      closeForm();
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    save();
  }

  function disconnect(id: string, name: string) {
    if (!confirm(`לנתק את ${name}? פרטי החיבור יימחקו ותצטרכו להזין אותם שוב.`)) return;
    setBusyProvider(id);
    startTransition(async () => {
      const res = await disconnectIntegrationAction(businessId, id);
      setBusyProvider(null);
      if (!res.ok) {
        toast.error(res.error ?? "הניתוק נכשל");
        return;
      }
      toast.success("הספק נותק");
      router.refresh();
    });
  }

  const anyConnected = providers.some((p) => connectedProviders.includes(p.id));

  return (
    <IntegrationCard
      icon={icon}
      title={title}
      subtitle={subtitle}
      status={<StatusBadge status={anyConnected ? "connected" : "not-connected"} />}
    >
      <div className="flex flex-col gap-2">
        {providers.map((p) => {
          const connected = connectedProviders.includes(p.id);
          const busy = busyProvider === p.id && isPending;
          return (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  {connected && <StatusBadge status="connected" />}
                </div>
                {p.description && (
                  <span className="text-xs text-muted-foreground">{p.description}</span>
                )}
                {p.docsUrl && (
                  <a
                    href={p.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    למדריך ההגדרה
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={busy}
                  onClick={() => openForm(p.id)}
                >
                  <Link2 className="size-3.5" />
                  {connected ? "עריכה" : "חיבור"}
                </Button>
                {connected && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                    disabled={busy}
                    onClick={() => disconnect(p.id, p.name)}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Unlink className="size-3.5" />}
                    ניתוק
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {children}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>חיבור {editing.name}</DialogTitle>
                <DialogDescription>
                  {editingConnected
                    ? "הפרטים מוצפנים ונשמרים בצד השרת בלבד — לעולם לא יוצגו חזרה. שדה שנשאר ריק ישמור על הערך הקיים שלו; מלאו רק את השדות שברצונכם לעדכן."
                    : "הפרטים מוצפנים ונשמרים בצד השרת בלבד — לעולם לא יוצגו חזרה. יש למלא את כל השדות המסומנים בכוכבית."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  {editing.fields.map((field) => (
                    <label key={field.key} className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">
                        {field.label}
                        {field.required && <span className="text-destructive"> *</span>}
                      </span>
                      <Input
                        dir="ltr"
                        type={field.secret ? "password" : "text"}
                        required={field.required && !editingConnected}
                        placeholder={
                          editingConnected && field.secret ? "•••••• (השאירו ריק כדי לשמור)" : field.placeholder
                        }
                        value={form[field.key] ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      />
                      {field.help && (
                        <span className="text-[11px] text-muted-foreground">{field.help}</span>
                      )}
                    </label>
                  ))}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeForm} disabled={isPending}>
                    ביטול
                  </Button>
                  <Button type="submit" disabled={isPending} className="gap-1.5">
                    {isPending && <Loader2 className="size-4 animate-spin" />}
                    שמירה
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>
    </IntegrationCard>
  );
}
