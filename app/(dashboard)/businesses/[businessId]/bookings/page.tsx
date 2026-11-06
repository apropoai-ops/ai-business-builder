import { notFound } from "next/navigation";
import { CalendarClock, CalendarDays, CalendarRange, Settings2, Users } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import {
  getBookingSettings,
  listBookingsRange,
  listBookingsForMonth,
} from "@/lib/services/booking.service";
import { listBookingServices } from "@/lib/services/booking-services.service";
import { getPlanForBusiness } from "@/lib/quota";
import { planAllows } from "@/lib/entitlements";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookingManager } from "@/components/business/booking-manager";
import { BookingCalendar } from "@/components/business/booking-calendar";
import { BookingMonthCalendar } from "@/components/business/booking-month-calendar";
import { BookingStaffManager } from "@/components/business/booking-staff-manager";
import { UpgradeGate } from "@/components/billing/upgrade-gate";
import type { WeeklyHours } from "@/lib/booking-shared";
import { assertNavAllowed } from "@/lib/dashboard-guard";

export const metadata = { title: "יומן תורים" };

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();
  assertNavAllowed(business.site_mode, "bookings");

  const plan = await getPlanForBusiness(businessId);
  if (!planAllows(plan, "bookings")) {
    return (
      <div className="flex flex-col gap-6">
        <UpgradeGate feature="bookings" />
      </div>
    );
  }

  // Server component — runs per request, so reading the clock is fine.
  const ilToday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
  const [curYear, curMonth] = ilToday.split("-").map(Number);

  const [settings, bookings, monthBookings, services] = await Promise.all([
    getBookingSettings(businessId),
    listBookingsRange(businessId),
    listBookingsForMonth(businessId, curYear, curMonth),
    listBookingServices(businessId),
  ]);

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const upcoming = bookings.filter(
    (b) => b.status !== "blocked" && new Date(b.starts_at).getTime() >= now - 86400_000,
  );
  const hasLegacyServices =
    services.length === 0 &&
    ((settings?.services as string[] | null) ?? []).some((s) => typeof s === "string" && s.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">יומן תורים</h1>
          <p className="text-sm text-muted-foreground">
            לקוחות קובעים תור באתר שלכם — והוא מופיע כאן לאישור
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendar" dir="rtl">
        <TabsList>
          <TabsTrigger value="calendar" className="gap-1.5">
            <CalendarDays className="size-3.5" />
            יומן
          </TabsTrigger>
          <TabsTrigger value="month" className="gap-1.5">
            <CalendarRange className="size-3.5" />
            חודש
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-1.5">
            <Settings2 className="size-3.5" />
            רשימות והגדרות
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="size-3.5" />
            צוות
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <BookingCalendar
            businessId={businessId}
            bookings={bookings}
            hours={(settings?.hours as WeeklyHours | null) ?? null}
            services={services}
          />
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          <BookingMonthCalendar
            businessId={businessId}
            hours={(settings?.hours as WeeklyHours | null) ?? null}
            initialBookings={monthBookings}
            initialYear={curYear}
            initialMonth={curMonth}
            todayStr={ilToday}
          />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <BookingManager
            businessId={businessId}
            settings={settings}
            bookings={upcoming}
            services={services}
            hasLegacyServices={hasLegacyServices}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <BookingStaffManager businessId={businessId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
