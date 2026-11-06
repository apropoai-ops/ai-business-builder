"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { importProductsAction } from "@/lib/actions/store";

/** Bulk import/export of products via CSV (opens in Excel/Sheets). */
export function ProductCsv({ businessId }: { businessId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    file
      .text()
      .then((text) =>
        startTransition(async () => {
          const res = await importProductsAction(businessId, text);
          setBusy(false);
          if (fileRef.current) fileRef.current.value = "";
          if (res.error) toast.error(res.error);
          else {
            toast.success(`יובאו ${res.created ?? 0} מוצרים חדשים, עודכנו ${res.updated ?? 0}`);
            router.refresh();
          }
        }),
      )
      .catch(() => {
        setBusy(false);
        toast.error("קריאת הקובץ נכשלה");
      });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <div className="text-sm font-semibold">ייבוא / ייצוא מוצרים (Excel/CSV)</div>
          <p className="text-xs text-muted-foreground">
            ייצאו לעריכה ב-Excel, או ייבאו קובץ לעדכון מרובה. עדכון לפי מק״ט (SKU).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/businesses/${businessId}/products/export`}>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="size-4" /> ייצוא
            </Button>
          </a>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => fileRef.current?.click()}
            disabled={busy || isPending}
          >
            {busy || isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            ייבוא
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </CardContent>
    </Card>
  );
}
