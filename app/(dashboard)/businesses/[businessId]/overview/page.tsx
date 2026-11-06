import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  FileText,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Wallet,
  UserPlus,
  ListChecks,
  Eye,
} from "lucide-react";

import { modeAllowsNav, type BusinessNavKey } from "@/lib/site-mode";
import { visibleDepartments } from "@/lib/dashboard-departments";
import { businessFitsRentals } from "@/lib/business-type";
import { getPlanForBusiness, getActiveAddonsForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";

import {
  getBusiness,
  getBusinessProfile,
} from "@/lib/services/business.service";
import { Card, CardContent } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";
import { GenerationWatcher } from "@/components/business/generation-watcher";
import { DailyBriefCard } from "@/components/business/daily-brief-card";
import { getLatestBrief, listRecentBriefs } from "@/lib/services/daily-brief.service";
import { getKpiStrip } from "@/lib/services/analytics.service";
import { formatILS } from "@/lib/quote-totals";
import type { DailyBriefContent } from "@/lib/ai/schemas/daily-brief";

export const metadata = { title: "סקירה" };

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  const profile = await getBusinessProfile(businessId);
  const planReady = Boolean(profile?.generated_at);

  // Still generating the first plan → show live progress.
  if (!planReady && business.status === "generating") {
    return <GenerationWatcher businessId={businessId} />;
  }

  // Same rule the sidebar uses — a card that links to a screen this build mode
  // doesn't have would land on a 404 (lib/dashboard-guard.ts).
  const allows = (key: BusinessNavKey) => modeAllowsNav(business.site_mode, key);

  const [latestBrief, recentBriefs, kpi, plan, addons] = await Promise.all([
    getLatestBrief(businessId),
    listRecentBriefs(businessId),
    getKpiStrip(businessId),
    getPlanForBusiness(businessId),
    getActiveAddonsForBusiness(businessId),
  ]);

  // Same three inputs the sidebar is given in the layout, so the launchpad
  // below can never offer a screen the sidebar hides (or 404 on a mode that
  // doesn't have it — lib/dashboard-guard.ts).
  const departments = visibleDepartments({
    siteMode: business.site_mode,
    sellsNights: businessFitsRentals(business),
    hasRentals: planAllows(plan, "rentals", addons),
    hiddenNavKeys: business.hidden_nav_keys,
  });

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Each tile wears the colour of the department it lands you in, so the
            strip teaches the same colour code the sidebar uses. */}
        {allows("reports") && (
          <KpiCard
            href={`/businesses/${businessId}/reports`}
            dept="command"
            icon={Wallet}
            label="הכנסות החודש"
            value={kpi.monthRevenue > 0 ? formatILS(kpi.monthRevenue) : "—"}
          />
        )}
        <KpiCard
          href={`/businesses/${businessId}/crm`}
          dept="customers"
          icon={UserPlus}
          label="לידים חדשים השבוע"
          value={kpi.newLeadsWeek}
        />
        <KpiCard
          href={`/businesses/${businessId}/crm`}
          dept="customers"
          icon={ListChecks}
          label="משימות פתוחות"
          value={kpi.openTasks}
        />
        <KpiCard
          href={`/businesses/${businessId}/analytics`}
          dept="command"
          icon={Eye}
          label="ביקורים (7 ימים)"
          value={kpi.visits7d}
        />
      </div>

      <DailyBriefCard
        businessId={businessId}
        brief={(latestBrief?.content as DailyBriefContent | null) ?? null}
        briefDate={latestBrief?.brief_date ?? null}
        recentBriefs={recentBriefs
          .filter((b) => b.brief_date !== latestBrief?.brief_date)
          .map((b) => ({
            briefDate: b.brief_date,
            content: b.content as unknown as DailyBriefContent,
          }))}
      />
      {planReady && allows("plan") && profile?.executive_summary && (
        <Card>
          <CardContent className="space-y-2 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <FileText className="size-4" />
              תקציר מנהלים
            </div>
            <p className="line-clamp-4 text-sm text-muted-foreground">
              {profile.executive_summary}
            </p>
            <ButtonLink
              href={`/businesses/${businessId}/plan`}
              variant="outline"
              size="sm"
            >
              לתוכנית המלאה
              <ArrowLeft className="size-4" />
            </ButtonLink>
          </CardContent>
        </Card>
      )}

      {/*
        The launchpad, department by department — the SAME seven departments in
        the SAME order and the same colours as the sidebar, because both read
        lib/dashboard-departments.ts. This used to be an arbitrary 9 screens
        under two headings ("רכיבי העסק" / "שיווק ואוטומציה") that matched
        neither the sidebar nor each other, so 18 screens had no entry point
        here at all and adding a screen meant remembering two files.
      */}
      {departments.map((dept) => (
        <section
          key={dept.id}
          aria-labelledby={`dept-${dept.id}`}
          style={{ "--dept": `var(--dept-${dept.id})` } as CSSProperties}
        >
          <h2
            id={`dept-${dept.id}`}
            className="mb-3 flex items-center gap-2 text-lg font-semibold"
          >
            <span
              aria-hidden
              className="inline-block size-2.5 rounded-full"
              style={{ background: "var(--dept)" }}
            />
            {dept.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dept.items
              .filter((item) => item.key !== "overview")
              .map((item) => (
                <FeatureCard
                  key={item.key}
                  href={`/businesses/${businessId}/${item.key}`}
                  icon={item.icon}
                  title={item.label}
                  blurb={item.blurb}
                />
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  dept,
}: {
  href: string;
  icon: typeof FileText;
  label: string;
  value: string | number;
  /** Department id whose colour this tile wears (see lib/dashboard-departments.ts). */
  dept: string;
}) {
  return (
    <Link href={href} style={{ "--dept": `var(--dept-${dept})` } as CSSProperties}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: "color-mix(in oklab, var(--dept) 12%, transparent)",
              color: "var(--dept)",
            }}
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xl font-bold leading-tight tabular-nums">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FeatureCard({
  href,
  icon: Icon,
  title,
  blurb,
  ready,
  locked,
}: {
  href?: string;
  icon: typeof FileText;
  title: string;
  /** One line on what the screen is for — the cards used to be title-only. */
  blurb?: string;
  ready?: boolean;
  locked?: boolean;
}) {
  const body = (
    <Card className={locked ? "opacity-60" : "h-full transition-shadow hover:shadow-md"}>
      <CardContent className="flex items-center gap-3 p-5">
        {/* Tinted in the department's own colour (--dept is set by the section
            above); falls back to the brand when rendered outside one. */}
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: "color-mix(in oklab, var(--dept, var(--primary)) 12%, transparent)",
            color: "var(--dept, var(--primary))",
          }}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          {blurb ? (
            <div className="text-xs text-muted-foreground">{blurb}</div>
          ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            {locked ? (
              <>
                <Lock className="size-3" /> בקרוב
              </>
            ) : ready ? (
              <>
                <CheckCircle2 className="size-3 text-primary" /> מוכן
              </>
            ) : (
              "ממתין"
            )}
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (href && !locked) {
    return <Link href={href}>{body}</Link>;
  }
  return body;
}
