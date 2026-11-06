import type { Metadata } from "next";
import { Building2, CalendarClock, CalendarX, Clock, LinkIcon, Scissors } from "lucide-react";

import {
  getBookingByCancelToken,
  MIN_CANCEL_NOTICE_MS,
} from "@/lib/services/booking.service";
import { getRescheduleContext } from "@/lib/services/booking-self.service";
import { CancelConfirm } from "./cancel-confirm";
import { ReschedulePicker } from "@/components/public/reschedule-picker";

const TZ = "Asia/Jerusalem";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata: Metadata = {
  title: "ביטול תור",
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        {children}
      </div>
    </div>
  );
}

function Notice({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {icon}
      <p className="text-lg font-semibold">{title}</p>
      {text && <p className="text-sm text-zinc-500">{text}</p>}
    </div>
  );
}

export default async function CancelBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const booking = UUID_RE.test(token)
    ? await getBookingByCancelToken(token)
    : null;

  if (!booking) {
    return (
      <Shell>
        <Notice
          icon={<LinkIcon className="size-10 text-zinc-400" />}
          title="הקישור אינו תקף"
          text="לא מצאנו תור שמתאים לקישור הזה — ייתכן שהוא שגוי או ישן. אם אתם צריכים עזרה, צרו קשר עם העסק."
        />
      </Shell>
    );
  }

  if (booking.status === "cancelled") {
    return (
      <Shell>
        <Notice
          icon={<CalendarX className="size-10 text-zinc-400" />}
          title="התור הזה כבר בוטל"
          text="אין צורך בפעולה נוספת. אם תרצו לקבוע תור חדש — אפשר לעשות זאת באתר העסק."
        />
      </Shell>
    );
  }

  // Reschedule needs the booking's service + the storefront slug (published
  // site required) — fetched separately since getBookingByCancelToken above
  // doesn't carry those fields. Falls back to cancel-only if unavailable.
  const rescheduleCtx = await getRescheduleContext(token);

  // Cancel + reschedule share the SAME per-business notice window
  // (booking_settings.cancel_notice_hours); fall back to the platform default
  // when the storefront context is unavailable.
  const noticeMs = rescheduleCtx
    ? rescheduleCtx.cancelNoticeHours * 3600_000
    : MIN_CANCEL_NOTICE_MS;
  const noticeHours = Math.round(noticeMs / 3600_000);
  // eslint-disable-next-line react-hooks/purity -- server component clock read
  const tooLate = new Date(booking.starts_at).getTime() - Date.now() < noticeMs;
  const rescheduleTooLate = rescheduleCtx != null && tooLate;

  const when = new Date(booking.starts_at);
  const dateStr = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(when);
  const timeStr = new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(when);

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <CalendarClock className="mx-auto mb-2 size-9 text-zinc-400" />
          <h1 className="text-xl font-bold">ביטול תור</h1>
          <p className="mt-1 text-sm text-zinc-500">
            היי {booking.customer_name}, אלו פרטי התור שלך:
          </p>
        </div>

        <dl className="space-y-2.5 rounded-xl bg-zinc-50 p-4 text-sm">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 shrink-0 text-zinc-400" />
            <dt className="font-medium text-zinc-500">עסק:</dt>
            <dd className="font-semibold">{booking.businessName}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-zinc-400" />
            <dt className="font-medium text-zinc-500">מועד:</dt>
            <dd className="font-semibold">
              {dateStr} בשעה {timeStr}
            </dd>
          </div>
          {booking.service && (
            <div className="flex items-center gap-2">
              <Scissors className="size-4 shrink-0 text-zinc-400" />
              <dt className="font-medium text-zinc-500">שירות:</dt>
              <dd className="font-semibold">{booking.service}</dd>
            </div>
          )}
        </dl>

        {tooLate ? (
          <p className="rounded-xl bg-amber-50 p-4 text-center text-sm font-medium text-amber-800">
            לא ניתן לבטל פחות מ-{noticeHours === 1 ? "שעה" : `${noticeHours} שעות`} לפני
            התור — צרו קשר עם העסק
          </p>
        ) : (
          <CancelConfirm token={token} />
        )}

        {rescheduleCtx && !rescheduleTooLate && (
          <ReschedulePicker
            token={token}
            slug={rescheduleCtx.slug}
            serviceId={rescheduleCtx.booking.service_id}
            staffId={rescheduleCtx.booking.staff_id}
          />
        )}
      </div>
    </Shell>
  );
}
