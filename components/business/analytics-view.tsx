import {
  Users,
  UserCheck,
  TrendingUp,
  CheckSquare,
  PenLine,
  CalendarDays,
  MessageCircle,
  Cpu,
  Eye,
  Globe,
  ReceiptText,
  Share2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { BusinessAnalytics } from "@/lib/services/analytics.service";
import { contentTypeLabels, type ContentType } from "@/lib/ai/schemas/content";
import { formatILS } from "@/lib/quote-totals";

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: "טיוטה",
  sent: "נשלחה",
  accepted: "אושרה",
  declined: "נדחתה",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "חדש",
  contacted: "נוצר קשר",
  qualified: "מתאים",
  lost: "אבוד",
};

const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "ליד",
  proposal: "הצעה",
  negotiation: "משא ומתן",
  won: "נסגר",
  lost: "אבד",
};

const AGENT_LABELS: Record<string, string> = {
  business_plan: "תוכנית עסקית",
  market_research: "מחקר שוק",
  branding: "מיתוג",
  website: "אתר",
  content: "מנוע תוכן",
  content_calendar: "לוח תוכן",
  social_media: "רשתות חברתיות",
  whatsapp: "וואטסאפ",
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
          {sub && <div className="text-[11px] text-muted-foreground/80">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function BarList({
  title,
  icon: Icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  items: { label: string; value: number }[];
  emptyText: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="size-4 text-primary" />
          {title}
        </div>
        {total === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {items
              .filter((i) => i.value > 0)
              .map((i) => (
                <div key={i.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/90">{i.label}</span>
                    <span className="font-medium tabular-nums">{i.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${(i.value / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VisitBars({ daily }: { daily: { day: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  const total = daily.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        עדיין אין ביקורים באתר
      </p>
    );
  }

  return (
    <div dir="ltr" className="flex h-32 items-stretch gap-1">
      {daily.map((d) => (
        <div
          key={d.day}
          className="flex flex-1 flex-col gap-1"
          title={`${d.day} · ${d.count} ביקורים`}
        >
          <div className="flex flex-1 items-end">
            <div
              className={`w-full rounded-sm ${d.count > 0 ? "bg-primary/70" : "bg-muted"}`}
              style={{ height: d.count > 0 ? `${Math.max((d.count / max) * 100, 6)}%` : "4px" }}
            />
          </div>
          <div className="text-center text-[10px] tabular-nums text-muted-foreground">
            {Number(d.day.slice(8))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsView({ data }: { data: BusinessAnalytics }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="לידים" value={data.leads.total} icon={Users} />
        <StatCard label="לקוחות" value={data.customers} icon={UserCheck} />
        <StatCard
          label="הכנסות (נסגר)"
          value={data.deals.wonValue > 0 ? `₪${data.deals.wonValue.toLocaleString()}` : "—"}
          sub={
            data.deals.pipelineValue > 0
              ? `בצנרת: ₪${data.deals.pipelineValue.toLocaleString()}`
              : undefined
          }
          icon={TrendingUp}
        />
        <StatCard
          label="משימות פתוחות"
          value={data.tasks.open}
          sub={data.tasks.done > 0 ? `הושלמו: ${data.tasks.done}` : undefined}
          icon={CheckSquare}
        />
      </div>

      {/* Site visits */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <StatCard
            label="ביקורים באתר (7 ימים)"
            value={data.visits.last7Days}
            icon={Eye}
          />
          <StatCard
            label="ביקורים באתר (30 יום)"
            value={data.visits.last30Days}
            icon={Globe}
          />
        </div>
        <Card className="lg:col-span-2">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="size-4 text-primary" />
              ביקורים באתר — 14 הימים האחרונים
            </div>
            <VisitBars daily={data.visits.daily} />
          </CardContent>
        </Card>
      </div>

      {/* Traffic sources + top pages */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="מקורות תנועה (30 יום)"
          icon={Share2}
          emptyText="אין עדיין נתוני מקור תנועה"
          items={data.visits.byReferrer.map((r) => ({ label: r.referrer, value: r.count }))}
        />
        <BarList
          title="דפים מובילים (30 יום)"
          icon={Globe}
          emptyText="אין עדיין נתוני דפים"
          items={data.visits.byPath.map((p) => ({ label: p.path, value: p.count }))}
        />
      </div>

      {/* Funnels */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title="משפך לידים"
          icon={Users}
          emptyText="עדיין אין לידים"
          items={["new", "contacted", "qualified", "lost"].map((s) => ({
            label: LEAD_STATUS_LABELS[s],
            value: data.leads.byStatus[s] ?? 0,
          }))}
        />
        <BarList
          title="צנרת עסקאות"
          icon={TrendingUp}
          emptyText="עדיין אין עסקאות"
          items={["lead", "proposal", "negotiation", "won", "lost"].map((s) => ({
            label: DEAL_STAGE_LABELS[s],
            value: data.deals.byStage[s] ?? 0,
          }))}
        />
      </div>

      {/* Quotes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title={`הצעות מחיר (${data.quotes.total})`}
          icon={ReceiptText}
          emptyText="עדיין אין הצעות מחיר"
          items={["draft", "sent", "accepted", "declined"].map((s) => ({
            label: QUOTE_STATUS_LABELS[s],
            value: data.quotes.byStatus[s] ?? 0,
          }))}
        />
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ReceiptText className="size-4 text-primary" />
              ביצועי הצעות מחיר
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {data.quotes.acceptedValue > 0 ? formatILS(data.quotes.acceptedValue) : "—"}
                </div>
                <div className="text-xs text-muted-foreground">סכום שאושר</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {Math.round(data.quotes.conversionRate * 100)}%
                </div>
                <div className="text-xs text-muted-foreground">שיעור אישור</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              שיעור האישור מחושב מתוך ההצעות שנשלחו ללקוחות.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content + WhatsApp */}
      <div className="grid gap-4 lg:grid-cols-3">
        <BarList
          title={`תוכן שנוצר (${data.content.total})`}
          icon={PenLine}
          emptyText="עדיין לא נוצר תוכן"
          items={Object.entries(data.content.byType).map(([type, value]) => ({
            label: contentTypeLabels[type as ContentType] ?? type,
            value,
          }))}
        />
        <BarList
          title="לוח תוכן"
          icon={CalendarDays}
          emptyText="עדיין אין לוח תוכן"
          items={[
            { label: "מתוכנן", value: data.calendar.planned },
            { label: "פורסם", value: data.calendar.published },
          ]}
        />
        <BarList
          title={`וואטסאפ (${data.whatsapp.conversations} שיחות)`}
          icon={MessageCircle}
          emptyText="עדיין אין שיחות וואטסאפ"
          items={[
            { label: "הודעות נכנסות", value: data.whatsapp.inbound },
            { label: "תגובות הסוכן", value: data.whatsapp.outbound },
          ]}
        />
      </div>

      {/* AI usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BarList
          title={`שימוש ב-AI (${data.ai.calls} קריאות)`}
          icon={Cpu}
          emptyText="עדיין אין קריאות AI"
          items={Object.entries(data.ai.byAgent)
            .sort((a, b) => b[1] - a[1])
            .map(([agent, value]) => ({
              label: AGENT_LABELS[agent] ?? agent,
              value,
            }))}
        />
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Cpu className="size-4 text-primary" />
              טוקנים
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {data.ai.tokensIn.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">קלט</div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <div className="text-lg font-bold tabular-nums">
                  {data.ai.tokensOut.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">פלט</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              נמדד מקריאות ה-AI של העסק הזה (agent logs).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
