"use client";

import { useState, useTransition } from "react";
import {
  CalendarPlus,
  CalendarDays,
  CalendarX,
  Clock,
  Loader2,
  LogIn,
  Repeat,
  RotateCcw,
} from "lucide-react";

import {
  listMyAppointmentsAction,
  cancelMyAppointmentAction,
} from "@/lib/actions/booking-self";
import type { MyAppointment } from "@/lib/services/booking-self.service";
import type { PublicBookingService, PublicBookingStaff } from "@/lib/booking-shared";
import { BookingWidget, type BookingPrefill } from "./booking-widget";
import { inkOn } from "@/lib/storefront-brand";

const TZ = "Asia/Jerusalem";

const STATUS_LABEL: Record<string, string> = {
  pending: "ממתין לאישור",
  confirmed: "מאושר",
  cancelled: "בוטל",
};

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

type Appointments = { upcoming: MyAppointment[]; past: MyAppointment[] };

/**
 * The storefront booking hub: "קביעת תור" (the booking widget) and
 * "התורים שלי" (the signed-in customer's appointments with self-cancel and
 * reschedule) — one friendly interface, right on the site.
 */
export function BookingHub({
  slug,
  brandColor,
  days,
  services,
  staff,
  staffServices,
  signedIn,
  loginHref,
  prefill,
}: {
  slug: string;
  brandColor: string;
  days: { date: string; label: string }[];
  services: PublicBookingService[];
  staff: PublicBookingStaff[];
  staffServices?: Record<string, string[]>;
  signedIn: boolean;
  loginHref: string;
  prefill?: BookingPrefill;
}) {
  const [tab, setTab] = useState<"book" | "mine">("book");
  const [appts, setAppts] = useState<Appointments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();

  function loadAppointments() {
    if (!signedIn) return;
    setError(null);
    startLoad(async () => {
      const res = await listMyAppointmentsAction(slug);
      if (res.error) setError(res.error);
      else setAppts({ upcoming: res.upcoming ?? [], past: res.past ?? [] });
    });
  }

  function openMine() {
    setTab("mine");
    if (!appts) loadAppointments();
  }

  function cancelAppt(id: string) {
    setCancellingId(id);
    setError(null);
    startLoad(async () => {
      const res = await cancelMyAppointmentAction(slug, id);
      setCancellingId(null);
      setConfirmId(null);
      if (!res.ok) setError(res.error ?? "הביטול נכשל");
      else {
        const r = await listMyAppointmentsAction(slug);
        if (!r.error) setAppts({ upcoming: r.upcoming ?? [], past: r.past ?? [] });
      }
    });
  }

  const tabBtn = (active: boolean) =>
    `flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
      active ? "text-white shadow-sm" : "bg-white text-zinc-600 hover:bg-zinc-100"
    }`;

  return (
    <div className="flex flex-col gap-4">
      {/* Tab switcher */}
      <div className="flex gap-1.5 rounded-2xl border bg-zinc-50 p-1.5">
        <button
          type="button"
          className={tabBtn(tab === "book")}
          style={tab === "book" ? { backgroundColor: brandColor, color: inkOn(brandColor) } : undefined}
          onClick={() => setTab("book")}
        >
          <CalendarPlus className="size-4" />
          קביעת תור
        </button>
        <button
          type="button"
          className={tabBtn(tab === "mine")}
          style={tab === "mine" ? { backgroundColor: brandColor, color: inkOn(brandColor) } : undefined}
          onClick={openMine}
        >
          <CalendarDays className="size-4" />
          התורים שלי
        </button>
      </div>

      {tab === "book" ? (
        <BookingWidget
          slug={slug}
          brandColor={brandColor}
          days={days}
          services={services}
          staff={staff}
          staffServices={staffServices ?? {}}
          prefill={prefill}
        />
      ) : !signedIn ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-8 text-center shadow-sm">
          <CalendarDays className="size-10 text-zinc-300" />
          <p className="font-semibold">התורים שלכם — במקום אחד</p>
          <p className="text-sm text-zinc-500">
            התחברו כדי לצפות בתורים הקרובים, לבטל או לשנות מועד — בלי טלפונים.
          </p>
          <a
            href={loginHref}
            className="mt-1 flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}
          >
            <LogIn className="size-4" />
            התחברות / הרשמה
          </a>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-center text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          {isLoading && !appts ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border bg-white p-8 text-sm text-zinc-500 shadow-sm">
              <Loader2 className="size-4 animate-spin" />
              טוען את התורים שלך…
            </div>
          ) : appts && appts.upcoming.length === 0 && appts.past.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border bg-white p-8 text-center shadow-sm">
              <CalendarX className="size-10 text-zinc-300" />
              <p className="text-sm text-zinc-500">עדיין אין לכם תורים אצלנו</p>
              <button
                type="button"
                className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}
                onClick={() => setTab("book")}
              >
                לקביעת התור הראשון
              </button>
            </div>
          ) : appts ? (
            <>
              {/* Upcoming */}
              {appts.upcoming.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {appts.upcoming.map((b) => {
                    const cancelled = b.status === "cancelled";
                    return (
                      <div
                        key={b.id}
                        className={`rounded-2xl border bg-white p-4 shadow-sm ${cancelled ? "opacity-50" : ""}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {fmtDate(b.starts_at)} · {fmtTime(b.starts_at)}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
                              {b.service && <span>{b.service}</span>}
                              {b.duration_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3.5" />
                                  {b.duration_minutes} דק&apos;
                                </span>
                              )}
                              {b.recurrence && (
                                <span className="flex items-center gap-1">
                                  <Repeat className="size-3.5" />
                                  תור קבוע
                                </span>
                              )}
                            </p>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-1 text-xs font-semibold"
                            style={{
                              backgroundColor: cancelled ? "#f4f4f5" : `${brandColor}1a`,
                              color: cancelled ? "#71717a" : brandColor,
                            }}
                          >
                            {STATUS_LABEL[b.status] ?? b.status}
                          </span>
                        </div>

                        {!cancelled && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {confirmId === b.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={cancellingId === b.id}
                                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                                  onClick={() => cancelAppt(b.id)}
                                >
                                  {cancellingId === b.id ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                  ) : (
                                    <CalendarX className="size-3.5" />
                                  )}
                                  אישור ביטול
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                  onClick={() => setConfirmId(null)}
                                >
                                  התחרטתי
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                                  onClick={() => setConfirmId(b.id)}
                                >
                                  <CalendarX className="size-3.5" />
                                  ביטול תור
                                </button>
                                <a
                                  href={`/cancel/${b.cancel_token}`}
                                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                                >
                                  <RotateCcw className="size-3.5" />
                                  שינוי מועד
                                </a>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Past visits */}
              {appts.past.length > 0 && (
                <details className="rounded-2xl border bg-white p-4 shadow-sm">
                  <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
                    היסטוריית ביקורים ({appts.past.length})
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {appts.past.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-sm"
                      >
                        <span className="text-zinc-600">
                          {fmtDate(b.starts_at)} · {fmtTime(b.starts_at)}
                          {b.service ? ` · ${b.service}` : ""}
                        </span>
                        <span className="text-xs font-medium text-zinc-400">
                          {b.no_show
                            ? "לא הגעת"
                            : b.status === "cancelled"
                              ? "בוטל"
                              : "התקיים"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <button
                type="button"
                className="self-center rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}
                onClick={() => setTab("book")}
              >
                קביעת תור נוסף
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
