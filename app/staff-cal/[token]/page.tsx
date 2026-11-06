import type { Metadata } from "next";
import { LinkIcon } from "lucide-react";

import { getStaffCalendar } from "@/lib/services/staff-calendar.service";
import { StaffCalendarView } from "@/components/public/staff-calendar-view";

export const metadata: Metadata = {
  title: "יומן אישי",
  robots: { index: false, follow: false },
};

/**
 * Public, tokenized, read-only calendar for one staff member (or the whole
 * business calendar when ?staff= is omitted). No auth required — the token
 * segment is the credential, mirroring the /q/[token] public quote page.
 * This is the in-app alternative to an ICS subscription: a barber opens this
 * on their phone each morning, no Google/Outlook account needed.
 */
export default async function StaffCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ staff?: string }>;
}) {
  const { token } = await params;
  const { staff } = await searchParams;

  const result = await getStaffCalendar(token, staff ?? null);

  if (!result.ok) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border bg-white p-10 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <LinkIcon className="size-10 text-zinc-400" />
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">הקישור לא תקין</p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            ייתכן שהקישור שגוי או שהוחלף בקישור חדש — בקשו קישור מעודכן מבעל/ת העסק.
          </p>
        </div>
      </div>
    );
  }

  return (
    <StaffCalendarView
      businessName={result.businessName ?? "העסק"}
      staffName={result.staffName}
      days={result.days ?? []}
    />
  );
}
