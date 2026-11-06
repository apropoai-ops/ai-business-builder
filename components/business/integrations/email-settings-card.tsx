"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2, Save, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { IntegrationCard, StatusBadge } from "@/components/business/integrations/integration-card";
import { saveEmailSettingsAction } from "@/lib/actions/integrations";
import type { EmailLogEntry } from "@/lib/services/email.service";

const STATUS_LABEL: Record<string, string> = {
  sent: "נשלח",
  failed: "נכשל",
  "skipped-no-key": "לא מוגדר",
};

const KIND_LABEL: Record<string, string> = {
  order_confirmation: "אישור הזמנה",
  booking_reminder: "תזכורת תור",
  booking_confirmed: "אישור תור",
  waitlist_slot_open: "רשימת המתנה",
  owner_notify: "התראה לבעל העסק",
  plan_welcome: "ברוכים הבאים",
  generic: "כללי",
};

function statusVariant(status: string): "default" | "destructive" | "outline" {
  if (status === "sent") return "default";
  if (status === "failed") return "destructive";
  return "outline";
}

export function EmailSettingsCard({
  businessId,
  emailFromName,
  emailReplyTo,
  configured,
  logs,
}: {
  businessId: string;
  emailFromName: string | null;
  emailReplyTo: string | null;
  /** RESEND_API_KEY present server-side. */
  configured: boolean;
  logs: EmailLogEntry[];
}) {
  const [fromName, setFromName] = useState(emailFromName ?? "");
  const [replyTo, setReplyTo] = useState(emailReplyTo ?? "");
  const [isPending, startTransition] = useTransition();

  // Every send is best-effort by design — an order must not fail because an
  // email did. The cost of that is silence: this product rejected every single
  // outgoing email for weeks (unverified sending domain) while the log quietly
  // filled with red badges nobody had a reason to open. A failing mail pipe is
  // an outage — customers get no order confirmation — so say so at the top,
  // with the provider's own words, which are the actionable part.
  const failures = logs.filter((l) => l.status === "failed");
  const lastFailure = failures[0];

  function save() {
    startTransition(async () => {
      const res = await saveEmailSettingsAction(businessId, {
        emailFromName: fromName,
        emailReplyTo: replyTo,
      });
      if (res.error) toast.error(res.error);
      else toast.success("ההגדרות נשמרו ✓");
    });
  }

  return (
    <IntegrationCard
      icon={Mail}
      title="אימייל"
      subtitle="מיילים אוטומטיים ללקוחות (אישורי הזמנה, תזכורות תור) ולבעל העסק"
      status={<StatusBadge status={configured ? "builtin" : "not-connected"} />}
    >
      {!configured && (
        <p className="text-xs text-muted-foreground">
          שליחת מיילים כבויה עד להגדרת RESEND_API_KEY בסביבת השרת.
        </p>
      )}

      {lastFailure && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-destructive">
              {failures.length === logs.length
                ? "אף מייל לא נשלח בהצלחה — הלקוחות שלכם לא מקבלים אישורי הזמנה"
                : `${failures.length} מתוך ${logs.length} המיילים האחרונים נכשלו`}
            </p>
            {lastFailure.error && (
              <p className="text-muted-foreground" dir="ltr">
                {lastFailure.error}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">שם השולח שיוצג</Label>
          <Input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="שם העסק שלכם"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">כתובת למענה (Reply-To)</Label>
          <Input
            dir="ltr"
            type="email"
            value={replyTo}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
      </div>
      <Button onClick={save} disabled={isPending} size="sm" className="w-fit gap-1.5">
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        שמירה
      </Button>

      <div className="flex flex-col gap-1.5 border-t pt-3">
        <span className="text-xs font-medium text-muted-foreground">20 המיילים האחרונים</span>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">עדיין לא נשלחו מיילים.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex flex-wrap items-center justify-between gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{log.subject}</span>
                  <span className="truncate text-muted-foreground" dir="ltr">
                    {log.to_email}
                  </span>
                  {log.status === "failed" && log.error && (
                    <span className="text-[11px] text-destructive" dir="ltr">
                      {log.error}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {KIND_LABEL[log.kind] ?? log.kind}
                  </Badge>
                  <Badge variant={statusVariant(log.status)} className="text-[10px]">
                    {STATUS_LABEL[log.status] ?? log.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </IntegrationCard>
  );
}
