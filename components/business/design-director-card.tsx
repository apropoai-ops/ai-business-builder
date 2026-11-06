"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wand2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { runDesignDirectorAction } from "@/lib/actions/design";

/**
 * One button that designs the whole business.
 *
 * It sits ABOVE the individual pickers rather than replacing them, and that
 * split is the point: the director decides everything at once and guarantees
 * the pieces agree, while the pickers below stay as manual overrides for an
 * owner who wants one thing different. Removing them would have traded a
 * coherence problem for a control problem.
 */
export function DesignDirectorCard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{
    rationale?: string;
    repairs?: string[];
    fromModel?: boolean;
    summary?: { theme: string; heroStyle: string; layout: string; fonts: string };
  } | null>(null);

  function run() {
    start(async () => {
      const res = await runDesignDirectorAction(businessId);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      toast.success("העיצוב עודכן — פלטה, פונטים, ערכת צבעים, פתיחה ומבנה ✓");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-sm font-semibold">במאי העיצוב</div>
            <p className="max-w-xl text-xs text-muted-foreground">
              מחליט על <b>הכול יחד</b> — פלטת צבעים, פונטים, ערכת הצבעים של האתר,
              אזור הפתיחה, מבנה העמוד וכיוון הלוגו — כדי שהכול ידבר באותה שפה.
              קודם כל אלה היו ארבע החלטות נפרדות שאף אחד לא בדק שמסתדרות יחד.
            </p>
          </div>
          <Button onClick={run} disabled={pending} className="gap-1.5">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
            {pending ? "מעצב..." : "עצב לי הכול"}
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg bg-muted/40 p-3">
            {result.summary && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span><b>ערכה:</b> {result.summary.theme}</span>
                <span><b>פתיחה:</b> {result.summary.heroStyle}</span>
                <span><b>מבנה:</b> {result.summary.layout}</span>
                <span><b>פונטים:</b> {result.summary.fonts}</span>
              </div>
            )}
            {result.rationale && (
              <p className="text-xs leading-relaxed text-muted-foreground">{result.rationale}</p>
            )}

            {/* Anything the coherence pass had to fix is shown, never hidden —
                a silent correction would read as the agent's own taste. */}
            {result.repairs && result.repairs.length > 0 && (
              <div className="space-y-1 border-t pt-2">
                <div className="flex items-center gap-1 text-[11px] font-medium text-amber-700">
                  <Info className="size-3" />
                  תיקונים אוטומטיים שבוצעו כדי שהעיצוב יעבוד:
                </div>
                <ul className="list-inside list-disc space-y-0.5 text-[11px] text-muted-foreground">
                  {result.repairs.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {result.fromModel === false && (
              <p className="text-[11px] text-muted-foreground">
                נבחר לפי כללי התחום (ה-AI לא היה זמין) — אפשר להריץ שוב.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
