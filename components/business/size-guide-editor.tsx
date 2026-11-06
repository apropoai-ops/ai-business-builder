"use client";

import { useState, useTransition } from "react";
import { Ruler, Plus, Trash2, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { setSizeGuideAction, type SizeGuide } from "@/lib/actions/size-guide";

const DEFAULT_GUIDE: SizeGuide = {
  headers: ["מידה", 'חזה (ס"מ)', 'אורך (ס"מ)'],
  rows: [
    { size: "S", cells: ["88", "66"] },
    { size: "M", cells: ["96", "70"] },
    { size: "L", cells: ["104", "74"] },
  ],
};

/** Defensively coerces unknown jsonb into a {headers, rows} shape. */
function parseGuide(initial: unknown): SizeGuide {
  if (!initial || typeof initial !== "object") return DEFAULT_GUIDE;
  const obj = initial as Record<string, unknown>;
  const headers = Array.isArray(obj.headers)
    ? obj.headers.map((h) => String(h ?? ""))
    : null;
  const rawRows = Array.isArray(obj.rows) ? obj.rows : null;
  if (!headers || headers.length === 0 || !rawRows) return DEFAULT_GUIDE;

  // Number of value columns = headers excluding the first (size) column.
  const valueCols = Math.max(0, headers.length - 1);
  const rows = rawRows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => {
      const cells = Array.isArray(r.cells) ? r.cells.map((c) => String(c ?? "")) : [];
      const padded = [...cells];
      while (padded.length < valueCols) padded.push("");
      return { size: String(r.size ?? ""), cells: padded.slice(0, valueCols) };
    });

  return { headers, rows: rows.length ? rows : DEFAULT_GUIDE.rows };
}

export function SizeGuideEditor({
  businessId,
  initial,
}: {
  businessId: string;
  initial: unknown;
}) {
  const [guide, setGuide] = useState<SizeGuide>(() => parseGuide(initial));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  const valueCols = Math.max(0, guide.headers.length - 1);

  function setHeader(i: number, value: string) {
    setGuide((g) => {
      const headers = [...g.headers];
      headers[i] = value;
      return { ...g, headers };
    });
  }

  function addColumn() {
    setGuide((g) => ({
      headers: [...g.headers, ""],
      rows: g.rows.map((r) => ({ ...r, cells: [...r.cells, ""] })),
    }));
  }

  function removeColumn(colIndex: number) {
    // colIndex is the value-column index (0-based, excluding the size column).
    setGuide((g) => ({
      headers: g.headers.filter((_, i) => i !== colIndex + 1),
      rows: g.rows.map((r) => ({
        ...r,
        cells: r.cells.filter((_, i) => i !== colIndex),
      })),
    }));
  }

  function setSize(rowIndex: number, value: string) {
    setGuide((g) => {
      const rows = [...g.rows];
      rows[rowIndex] = { ...rows[rowIndex], size: value };
      return { ...g, rows };
    });
  }

  function setCell(rowIndex: number, colIndex: number, value: string) {
    setGuide((g) => {
      const rows = [...g.rows];
      const cells = [...rows[rowIndex].cells];
      cells[colIndex] = value;
      rows[rowIndex] = { ...rows[rowIndex], cells };
      return { ...g, rows };
    });
  }

  function addRow() {
    setGuide((g) => ({
      ...g,
      rows: [...g.rows, { size: "", cells: Array(valueCols).fill("") }],
    }));
  }

  function removeRow(rowIndex: number) {
    setGuide((g) => ({ ...g, rows: g.rows.filter((_, i) => i !== rowIndex) }));
  }

  function save() {
    startTransition(async () => {
      // Send null when the table is effectively empty.
      const hasContent =
        guide.headers.some((h) => h.trim()) ||
        guide.rows.some((r) => r.size.trim() || r.cells.some((c) => c.trim()));
      const res = await setSizeGuideAction(businessId, hasContent ? guide : null);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(hasContent ? "טבלת המידות נשמרה ✓" : "טבלת המידות הוסרה");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="size-4 text-primary" />
          טבלת מידות
        </div>
        <p className="text-xs text-muted-foreground">
          טבלת המידות תוצג ללקוחות בכפתור &apos;טבלת מידות&apos; באתר.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {guide.headers.map((h, i) => (
                  <th key={i} className="p-1 align-bottom">
                    <Input
                      value={h}
                      onChange={(e) => setHeader(i, e.target.value)}
                      placeholder={i === 0 ? "מידה" : "כותרת"}
                      className="min-w-[90px] text-center font-semibold"
                    />
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(i - 1)}
                        className="mt-1 flex w-full items-center justify-center text-muted-foreground transition hover:text-red-600"
                        aria-label="הסרת עמודה"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </th>
                ))}
                <th className="p-1 align-bottom">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColumn}
                    className="gap-1"
                  >
                    <Plus className="size-3.5" />
                    עמודה
                  </Button>
                </th>
              </tr>
            </thead>
            <tbody>
              {guide.rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="p-1">
                    <Input
                      value={row.size}
                      onChange={(e) => setSize(ri, e.target.value)}
                      placeholder="מידה"
                      className="min-w-[80px] text-center"
                    />
                  </td>
                  {Array.from({ length: valueCols }).map((_, ci) => (
                    <td key={ci} className="p-1">
                      <Input
                        value={row.cells[ci] ?? ""}
                        onChange={(e) => setCell(ri, ci, e.target.value)}
                        className="min-w-[80px] text-center"
                      />
                    </td>
                  ))}
                  <td className="p-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeRow(ri)}
                      className="text-muted-foreground transition hover:text-red-600"
                      aria-label="הסרת שורה"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
            <Plus className="size-3.5" />
            הוספת שורה
          </Button>
          <Button onClick={save} disabled={isPending} className="gap-1.5">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : saved ? (
              <Check className="size-4" />
            ) : null}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
