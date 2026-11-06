"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, ExternalLink, Loader2, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  saveGatewayConnectionAction,
  setGatewayEnabledAction,
  deleteGatewayConnectionAction,
} from "@/lib/actions/payment-gateways";
import type { GatewayMeta } from "@/lib/gateways/registry";
import type { ConnectionSummary } from "@/lib/services/payment-connections.service";

/**
 * Shopify-style "ספקי סליקה" connect UI. Lets the owner connect their OWN
 * Israeli payment provider so storefront card payments go directly to their
 * account. Credentials are write-only: the server (payment-connections
 * service) never returns stored values, so this component never renders them
 * back — the form always starts blank, even when editing an existing
 * connection. Only one provider may be enabled at a time; enabling one
 * disables the rest server-side (setConnectionEnabled), and this component
 * reflects that by refreshing the whole list after any toggle.
 */
export function PaymentGatewaysManager({
  businessId,
  meta,
  connections,
}: {
  businessId: string;
  meta: GatewayMeta[];
  connections: ConnectionSummary[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const byProvider = new Map(connections.map((c) => [c.provider, c]));
  const editingMeta = meta.find((m) => m.key === editingProvider) ?? null;

  function openForm(provider: string) {
    setEditingProvider(provider);
    setForm({});
  }

  function closeForm() {
    setEditingProvider(null);
    setForm({});
  }

  function save() {
    if (!editingMeta) return;
    setBusyProvider(editingMeta.key);
    startTransition(async () => {
      const res = await saveGatewayConnectionAction(businessId, editingMeta.key, form);
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

  function setEnabled(provider: string, enabled: boolean) {
    setBusyProvider(provider);
    startTransition(async () => {
      const res = await setGatewayEnabledAction(businessId, provider, enabled);
      setBusyProvider(null);
      if (!res.ok) {
        toast.error(res.error ?? "העדכון נכשל");
        return;
      }
      toast.success(enabled ? "הספק הופעל ✓" : "הספק הושבת");
      router.refresh();
    });
  }

  function disconnect(provider: string, label: string) {
    if (!confirm(`לנתק את ${label}? פרטי החיבור יימחקו ותצטרכו להזין אותם שוב.`)) return;
    setBusyProvider(provider);
    startTransition(async () => {
      const res = await deleteGatewayConnectionAction(businessId, provider);
      setBusyProvider(null);
      if (!res.ok) {
        toast.error(res.error ?? "הניתוק נכשל");
        return;
      }
      toast.success("הספק נותק");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="size-4 text-primary" />
            ספקי סליקה
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            חברו את חשבון הסליקה הישראלי שלכם — התשלומים בחנות ייגבו ישירות לחשבונכם
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {meta.map((g) => {
            const conn = byProvider.get(g.key);
            const connected = conn?.connected ?? false;
            const enabled = conn?.enabled ?? false;
            const busy = busyProvider === g.key && isPending;

            return (
              <div
                key={g.key}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{g.label}</span>
                    {enabled ? (
                      <Badge variant="default" className="text-[10px]">פעיל</Badge>
                    ) : connected ? (
                      <Badge variant="secondary" className="text-[10px]">מחובר</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        לא מחובר
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{g.description}</span>
                  <a
                    href={g.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <ExternalLink className="size-3" />
                    למדריך ההגדרה של {g.label}
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  {connected && (
                    <Switch
                      checked={enabled}
                      disabled={busy}
                      onCheckedChange={(checked) => setEnabled(g.key, checked)}
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={busy}
                    onClick={() => openForm(g.key)}
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
                      onClick={() => disconnect(g.key, g.label)}
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
      </CardContent>

      <Dialog open={editingMeta !== null} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent>
          {editingMeta && (
            <>
              <DialogHeader>
                <DialogTitle>חיבור {editingMeta.label}</DialogTitle>
                <DialogDescription>
                  הפרטים מוצפנים ונשמרים בצד השרת בלבד — לעולם לא יוצגו חזרה. להזנת פרטים חדשים יש למלא את כל השדות מחדש.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-3">
                {editingMeta.credentialFields.map((field) => (
                  <label key={field.key} className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      {field.label}
                      {field.required && <span className="text-destructive"> *</span>}
                    </span>
                    <Input
                      dir="ltr"
                      type={field.type}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={form[field.key] ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field.key]: e.target.value }))
                      }
                    />
                    {field.help && (
                      <span className="text-[11px] text-muted-foreground">{field.help}</span>
                    )}
                  </label>
                ))}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeForm} disabled={isPending}>
                  ביטול
                </Button>
                <Button onClick={save} disabled={isPending} className="gap-1.5">
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  שמירה
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
