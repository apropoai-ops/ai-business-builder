import Link from "next/link";
import { ArrowRight, ExternalLink, MessageCircle, LifeBuoy, Clock } from "lucide-react";

import { WHATSAPP_STEPS, WHATSAPP_TROUBLESHOOTING } from "@/lib/whatsapp-guide";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * The long-form walkthrough. The connection tab shows a compact version of the
 * same steps (both read lib/whatsapp-guide.ts, so they can't drift); this page
 * adds the per-step detail and the troubleshooting table, which is where an
 * owner ends up when the agent is connected but silent.
 */
export function WhatsappGuideContent() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">חיבור סוכן הוואטסאפ — מדריך מלא</h1>
          <p className="text-sm text-muted-foreground">
            שמונה שלבים מחשבון ריק ועד סוכן שעונה ללקוחות. כל שלב מפנה לעמוד המדויק שבו
            עושים אותו.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            כ-30 דקות בפעם הראשונה
          </span>
          <span>·</span>
          <span>נדרש: חשבון פייסבוק, ומספר טלפון שאינו פעיל באפליקציית וואטסאפ רגילה</span>
        </CardContent>
      </Card>

      <ol className="flex flex-col gap-4">
        {WHATSAPP_STEPS.map((step, i) => (
          <li key={step.title}>
            <Card>
              <CardContent className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h2 className="text-base font-semibold">{step.title}</h2>
                  {step.yields && (
                    <Badge variant="outline" className="text-[11px] font-normal">
                      נותן: {step.yields}
                    </Badge>
                  )}
                </div>

                <p className="text-sm leading-relaxed">{step.body}</p>

                {step.detail && (
                  <ul className="space-y-1.5 border-e-2 pe-3 text-sm text-muted-foreground">
                    {step.detail.map((d) => (
                      <li key={d} className="leading-relaxed">
                        {d}
                      </li>
                    ))}
                  </ul>
                )}

                {step.link && (
                  <a
                    href={step.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {step.link.label}
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div id="troubleshooting" className="scroll-mt-6">
        <div className="mb-3 flex items-center gap-2">
          <LifeBuoy className="size-4 text-primary" />
          <h2 className="text-base font-semibold">פתרון תקלות</h2>
        </div>
        <div className="flex flex-col gap-2">
          {WHATSAPP_TROUBLESHOOTING.map((t) => (
            <Card key={t.problem}>
              <CardContent className="space-y-1 py-3">
                <div className="text-sm font-medium">{t.problem}</div>
                <p className="text-sm leading-relaxed text-muted-foreground">{t.fix}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-2 py-4 text-sm">
          <div className="font-semibold">כמה דברים שכדאי לדעת מראש</div>
          <ul className="space-y-1.5 text-muted-foreground">
            <li>
              וואטסאפ מאפשר מענה חופשי רק בתוך 24 שעות מההודעה האחרונה של הלקוח. מעבר לכך
              נדרשת תבנית הודעה מאושרת מראש מ-Meta.
            </li>
            <li>
              מספר בדיקה של Meta הוא חינמי לחלוטין ומצוין להתנסות, אבל שולח רק למספרים
              שהוספתם ידנית. למספר אמיתי נדרש אימות עסק אצל Meta.
            </li>
            <li>
              מספר שכבר פעיל באפליקציית וואטסאפ רגילה או Business לא יכול לשמש ל-API. צריך
              למחוק שם את החשבון קודם, וזה בלתי הפיך.
            </li>
            <li>
              ה-Access Token וה-App Secret נשמרים אצלנו ומשמשים רק לשליחה ולאימות ההודעות
              של העסק שלכם.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a
          href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          התיעוד הרשמי של WhatsApp Cloud API
          <ExternalLink className="size-3.5" />
        </a>
        <Link
          href="/businesses"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowRight className="size-3.5" />
          חזרה לעסקים
        </Link>
      </div>
    </div>
  );
}
