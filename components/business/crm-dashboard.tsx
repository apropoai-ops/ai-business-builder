"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, UserCheck, CheckSquare, TrendingUp,
  CalendarClock, Download, LayoutDashboard,
  MessageCircle, PackageCheck, RefreshCcw,
} from "lucide-react";
import Link from "next/link";

import type { CrmLead, CrmCustomer, CrmTask, CrmDeal } from "@/types/database";
import type { CrmFocus } from "@/lib/services/crm.service";
import { modeAllowsNav } from "@/lib/site-mode";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { TodayView } from "@/components/business/crm/today-view";
import { LeadsTab } from "@/components/business/crm/leads-tab";
import { CustomersTab } from "@/components/business/crm/customers-tab";
import { TasksTab } from "@/components/business/crm/tasks-tab";
import { DealsTab } from "@/components/business/crm/deals-tab";

type Props = {
  businessId: string;
  leads: CrmLead[];
  customers: CrmCustomer[];
  tasks: CrmTask[];
  deals: CrmDeal[];
  upcomingBookings?: number;
  /** Aggregated "today" focus data (overdue tasks, stale leads, birthdays, ...). */
  focus: CrmFocus;
  /**
   * Store desks folded in as tabs — a ReactNode per tab, so the server page
   * decides what a business is entitled to and this stays a dumb shell.
   * Orders, returns and the WhatsApp follow-up queue used to be three separate
   * nav entries, which meant a customer who ordered, then asked a question on
   * WhatsApp, then wanted to return it existed as three unrelated rows in three
   * screens. They are all the same person, so they are all the same screen.
   */
  orders?: React.ReactNode;
  returns?: React.ReactNode;
  followUps?: React.ReactNode;
  /** How many WhatsApp conversations are waiting on a human, for the badge. */
  pendingReplies?: number;
  /** Tab to open on mount, from ?tab= — keeps the old /orders links working. */
  defaultTab?: string;
  /** businesses.site_mode — decides which cross-links the CRM may offer. */
  siteMode?: string | null;
};

/**
 * Which mode-gated screens the CRM may link out to. The tabs run deep inside
 * client components, so this rides a context instead of five levels of props —
 * a "הצעה" button that lands on a 404 is worse than no button.
 */
const CrmNavContext = createContext<{ quotes: boolean }>({ quotes: true });

export function useCrmNav() {
  return useContext(CrmNavContext);
}

export function CrmDashboard({
  businessId,
  leads: initialLeads,
  customers: initialCustomers,
  tasks: initialTasks,
  deals: initialDeals,
  upcomingBookings = 0,
  focus,
  orders,
  returns,
  followUps,
  pendingReplies = 0,
  defaultTab,
  siteMode,
}: Props) {
  const showBookings = modeAllowsNav(siteMode, "bookings");
  const showQuotes = modeAllowsNav(siteMode, "quotes");
  const router = useRouter();
  const refresh = () => router.refresh();
  // Lifted so the global search (Ctrl+K) can switch tabs for deal/task
  // results, which don't have a dedicated detail dialog of their own.
  const [tab, setTab] = useState(defaultTab || "today");

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalDealValue = initialDeals
    .filter((d) => d.stage === "won")
    .reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <CrmNavContext.Provider value={{ quotes: showQuotes }}>
    <div className="space-y-4">
      {/* Summary cards — quick search lives in the global header (Ctrl+K) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="לידים" value={initialLeads.length} icon={<Users className="size-4" />} />
        <StatCard label="לקוחות" value={initialCustomers.length} icon={<UserCheck className="size-4" />} />
        {showBookings && (
          <Link href={`/businesses/${businessId}/bookings`}>
            <StatCard label="תורים קרובים" value={upcomingBookings} icon={<CalendarClock className="size-4" />} />
          </Link>
        )}
        <StatCard label="משימות פתוחות" value={initialTasks.filter((t) => !t.done).length} icon={<CheckSquare className="size-4" />} />
        <StatCard label="הכנסות (נסגר)" value={totalDealValue > 0 ? `₪${totalDealValue.toLocaleString()}` : "—"} icon={<TrendingUp className="size-4" />} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v))} dir="rtl">
        <TabsList aria-label="לשוניות לקוחות ומכירות" className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="today" className="gap-1.5"><LayoutDashboard className="size-3.5" />היום שלי</TabsTrigger>
          <TabsTrigger value="leads" className="gap-1.5"><Users className="size-3.5" />לידים</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5"><UserCheck className="size-3.5" />לקוחות</TabsTrigger>
          <TabsTrigger value="tasks" className="gap-1.5"><CheckSquare className="size-3.5" />משימות</TabsTrigger>
          <TabsTrigger value="deals" className="gap-1.5"><TrendingUp className="size-3.5" />עסקאות</TabsTrigger>
          {followUps && (
            <TabsTrigger value="whatsapp" className="gap-1.5">
              <MessageCircle className="size-3.5" />
              ממתין למענה
              {pendingReplies > 0 && (
                <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                  {pendingReplies}
                </span>
              )}
            </TabsTrigger>
          )}
          {orders && (
            <TabsTrigger value="orders" className="gap-1.5"><PackageCheck className="size-3.5" />הזמנות</TabsTrigger>
          )}
          {returns && (
            <TabsTrigger value="returns" className="gap-1.5"><RefreshCcw className="size-3.5" />החזרות</TabsTrigger>
          )}
        </TabsList>

        {/* TODAY */}
        <TabsContent value="today">
          <TodayView businessId={businessId} focus={focus} />
        </TabsContent>

        {/* LEADS */}
        <TabsContent value="leads">
          <LeadsTab businessId={businessId} leads={initialLeads} onRefresh={refresh} />
        </TabsContent>

        {/* CUSTOMERS */}
        <TabsContent value="customers">
          <CustomersTab businessId={businessId} customers={initialCustomers} onRefresh={refresh} />
        </TabsContent>

        {/* TASKS */}
        <TabsContent value="tasks">
          <TasksTab businessId={businessId} tasks={initialTasks} leads={initialLeads} customers={initialCustomers} onRefresh={refresh} />
        </TabsContent>

        {/* DEALS */}
        <TabsContent value="deals">
          <DealsTab businessId={businessId} deals={initialDeals} onRefresh={refresh} />
        </TabsContent>

        {/* Store desks — each renders only when the page passed one in. */}
        {followUps && <TabsContent value="whatsapp">{followUps}</TabsContent>}
        {orders && <TabsContent value="orders">{orders}</TabsContent>}
        {returns && <TabsContent value="returns">{returns}</TabsContent>}
      </Tabs>
    </div>
    </CrmNavContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers (used across the CRM tab modules)
// ─────────────────────────────────────────────────────────────────────────────
export function quoteHref(businessId: string, name: string, phone?: string | null): string {
  const params = new URLSearchParams({ name });
  if (phone) params.set("phone", phone);
  return `/businesses/${businessId}/quotes?${params.toString()}`;
}

export function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <div className="text-lg font-bold leading-none">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{text}</div>
  );
}

export function ExportCsvLink({ businessId, type }: { businessId: string; type: "leads" | "customers" }) {
  return (
    <a
      href={`/api/businesses/${businessId}/crm/export?type=${type}`}
      download
      className={buttonVariants({ variant: "outline", size: "sm" })}
      title={type === "leads" ? "ייצוא לידים לקובץ CSV" : "ייצוא לקוחות לקובץ CSV"}
    >
      <Download className="size-3.5" />
      ייצוא CSV
    </a>
  );
}
