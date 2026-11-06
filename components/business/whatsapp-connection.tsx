"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Loader2,
  Save,
  Plug,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { saveWhatsappConnectionAction } from "@/lib/actions/whatsapp";
import { WHATSAPP_STEPS } from "@/lib/whatsapp-guide";
import type { WhatsappConfig } from "@/types/database";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-md border bg-muted/50 px-2 py-1.5 text-xs" dir="ltr">
          {value}
        </code>
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function WhatsappConnection({
  businessId,
  config,
  webhookUrl,
  verifyToken,
  hasAccessToken = false,
  hasAppSecret = false,
}: {
  businessId: string;
  config: WhatsappConfig | null;
  /** The saved secrets themselves are never sent to the browser. */
  hasAccessToken?: boolean;
  hasAppSecret?: boolean;
  webhookUrl: string;
  verifyToken: string;
}) {
  const [phoneNumberId, setPhoneNumberId] = useState(config?.phone_number_id ?? "");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [displayPhone, setDisplayPhone] = useState(config?.display_phone ?? "");
  const [connected, setConnected] = useState(config?.connected ?? false);
  const [isPending, startTransition] = useTransition();

  function save(nextConnected: boolean) {
    startTransition(async () => {
      const res = await saveWhatsappConnectionAction(businessId, {
        phone_number_id: phoneNumberId,
        access_token: accessToken,
        app_secret: appSecret,
        display_phone: displayPhone,
        connected: nextConnected,
      });
      if (res.error) toast.error(res.error);
      else {
        setConnected(nextConnected);
        toast.success(nextConnected ? "וואטסאפ מחובר ✓" : "החיבור נשמר");
      }
    });
  }

  const canConnect = phoneNumberId.trim() && (accessToken.trim() || hasAccessToken);
  // The webhook rejects unsigned/mis-signed events, so connecting without this
  // produces a agent that looks alive here and never answers a real customer.
  const missingSecret = Boolean(canConnect) && !appSecret.trim() && !hasAppSecret;

  // The last two steps happen on this page, so the checklist stops before them.
  const metaSteps = WHATSAPP_STEPS.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      {/* Status */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 py-4">
          <div className="flex items-center gap-2">
            <Plug className="size-4 text-primary" />
            <span className="font-medium">סטטוס חיבור</span>
          </div>
          {connected ? (
            <Badge className="gap-1 bg-green-600">
              <CheckCircle2 className="size-3" /> מחובר
            </Badge>
          ) : (
            <Badge variant="outline">לא מחובר</Badge>
          )}
        </CardContent>
      </Card>

      {/* The walkthrough — every step links to the exact page it happens on. */}
      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">מה צריך לעשות אצל Meta</div>
            <Link
              href="/guides/whatsapp"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <BookOpen className="size-3.5" />
              המדריך המלא
            </Link>
          </div>

          <ol className="space-y-3">
            {metaSteps.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{step.title}</span>
                    {step.yields && (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        נותן: {step.yields}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
                  {step.link && (
                    <a
                      href={step.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {step.link.label}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Step 6 needs these two values, so they sit right under it. */}
          <div className="space-y-3 rounded-lg bg-muted/40 p-3">
            <div className="text-xs font-semibold">
              הערכים להדבקה במסך ה-Webhook (שלב 6)
            </div>
            <CopyField label="Callback URL" value={webhookUrl} />
            <CopyField label="Verify Token" value={verifyToken} />
            <p className="text-[11px] text-muted-foreground">
              אחרי השמירה יש להיכנס ל-Manage ולסמן את השדה{" "}
              <code className="text-foreground">messages</code>. בלעדיו לא תגיע אף הודעה.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Credentials */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="text-sm font-semibold">שלב 7 · הדביקו כאן את מה שאספתם</div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Phone Number ID</label>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="לדוגמה: 123456789012345"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">מתוך WhatsApp → API Setup (שלב 3).</p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Access Token</label>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder={hasAccessToken ? "שמור ✓ — השאירו ריק כדי לא לשנות" : "EAAG..."}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              טוקן של System User עם תוקף Never (שלב 4). טוקן זמני יפסיק לעבוד אחרי 24 שעות.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">App Secret</label>
            <Input
              type="password"
              value={appSecret}
              onChange={(e) => setAppSecret(e.target.value)}
              placeholder={hasAppSecret ? "שמור ✓ — השאירו ריק כדי לא לשנות" : "•••••••••••••••"}
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              מתוך Settings → Basic באפליקציה (שלב 5). משמש לאימות שההודעות באמת שלכם.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">מספר התצוגה (אופציונלי)</label>
            <Input
              value={displayPhone}
              onChange={(e) => setDisplayPhone(e.target.value)}
              placeholder="+972..."
              dir="ltr"
            />
          </div>

          {missingSecret && (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs">
              בלי App Secret לא נוכל לאמת את ההודעות הנכנסות, והסוכן לא יענה ללקוחות אמיתיים
              גם אם הסטטוס כאן יראה &quot;מחובר&quot;.
            </p>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={() => save(connected)} disabled={isPending || !canConnect} className="gap-2">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              שמור
            </Button>
            {connected ? (
              <Button variant="destructive" onClick={() => save(false)} disabled={isPending}>
                נתק
              </Button>
            ) : (
              <Button onClick={() => save(true)} disabled={isPending || !canConnect} className="gap-2">
                <Plug className="size-4" />
                חבר והפעל
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Final check */}
      <Card>
        <CardContent className="space-y-2 py-4">
          <div className="text-sm font-semibold">שלב 8 · בדקו שזה עובד</div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {WHATSAPP_STEPS[7].body}
          </p>
          <Link
            href="/guides/whatsapp#troubleshooting"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            משהו לא עובד? פתרון תקלות
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
