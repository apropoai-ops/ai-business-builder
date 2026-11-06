import { notFound } from "next/navigation";
import { DatabaseBackup, Users, ShoppingBag, CalendarClock, ShieldCheck } from "lucide-react";

import { getBusiness } from "@/lib/services/business.service";
import { DataExportCard } from "@/components/business/data-export-card";

export const metadata = { title: "גיבוי וייצוא נתונים" };

export default async function ExportPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const business = await getBusiness(businessId);
  if (!business) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <DatabaseBackup className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">גיבוי וייצוא נתונים</h1>
          <p className="text-sm text-muted-foreground">
            הורידו את הנתונים שלכם כקובץ CSV בכל רגע — לגיבוי אישי, לניתוח ב-Excel, או להעברה למערכת אחרת
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DataExportCard
          businessId={businessId}
          entity="customers"
          title="לקוחות"
          description="שם, טלפון, אימייל, הערות ותגיות"
          icon={Users}
        />
        <DataExportCard
          businessId={businessId}
          entity="orders"
          title="הזמנות"
          description="מוצרים, סטטוס, תשלום ומשלוח"
          icon={ShoppingBag}
        />
        <DataExportCard
          businessId={businessId}
          entity="bookings"
          title="תורים"
          description="לקוחות, מועדים וסטטוס הגעה"
          icon={CalendarClock}
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <p>
          מעבר לייצוא הידני כאן — כל הנתונים שלכם מגובים באופן שוטף ברמת התשתית (Supabase),
          כך שגם בלי לפעול מולכם, המידע שמור ומאובטח.
        </p>
      </div>
    </div>
  );
}
