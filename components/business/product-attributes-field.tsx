"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Free-form key/value spec rows ("חומר: עור", "משקל: 300 גרם") for whatever a
 * given product needs beyond the fixed fields — same jsonb pattern as
 * colors/engraving above it, serialized into one hidden JSON field that
 * lib/actions/store.ts's parseAttributes reads.
 */
export function ProductAttributesField({
  name = "attributes",
  initial = {},
}: {
  name?: string;
  initial?: Record<string, string>;
}) {
  const [rows, setRows] = useState<{ key: string; value: string }[]>(
    Object.entries(initial).map(([key, value]) => ({ key, value })),
  );

  function update(i: number, field: "key" | "value", v: string) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)));
  }

  function add() {
    setRows((prev) => [...prev, { key: "", value: "" }]);
  }

  function remove(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  const serialized = JSON.stringify(
    Object.fromEntries(rows.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value.trim()])),
  );

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">
        מאפיינים נוספים (אופציונלי) — כל שדה שהמוצר הזה צריך
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Input
              value={row.key}
              onChange={(e) => update(i, "key", e.target.value)}
              placeholder="שם (למשל: חומר)"
              className="w-1/3"
            />
            <Input
              value={row.value}
              onChange={(e) => update(i, "value", e.target.value)}
              placeholder="ערך (למשל: עור אמיתי)"
            />
            <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => remove(i)}>
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={add}>
        <Plus className="size-3.5" />
        הוספת מאפיין
      </Button>
      <input type="hidden" name={name} value={serialized} />
    </div>
  );
}
