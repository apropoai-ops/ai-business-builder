"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Ruler, X } from "lucide-react";

type ParsedGuide = {
  headers: string[];
  rows: { size: string; cells: string[] }[];
};

/** Defensively coerces unknown jsonb into a renderable guide, or null if empty/invalid. */
function parseGuide(guide: unknown): ParsedGuide | null {
  if (!guide || typeof guide !== "object") return null;
  const obj = guide as Record<string, unknown>;
  const headers = Array.isArray(obj.headers)
    ? obj.headers.map((h) => String(h ?? ""))
    : null;
  const rawRows = Array.isArray(obj.rows) ? obj.rows : null;
  if (!headers || headers.length === 0 || !rawRows) return null;

  const rows = rawRows
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      size: String(r.size ?? ""),
      cells: Array.isArray(r.cells) ? r.cells.map((c) => String(c ?? "")) : [],
    }))
    .filter((r) => r.size.trim() || r.cells.some((c) => c.trim()));

  if (!rows.length) return null;
  return { headers, rows };
}

export function SizeGuide({ guide, brand }: { guide: unknown; brand: string }) {
  const [open, setOpen] = useState(false);
  const parsed = parseGuide(guide);
  if (!parsed) return null;

  const valueCols = Math.max(0, parsed.headers.length - 1);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition hover:bg-black/5"
        style={{ borderColor: brand, color: brand }}
      >
        <Ruler className="size-4" />
        טבלת מידות
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={() => setOpen(false)}
            dir="rtl"
          >
            <div
              className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 text-zinc-900 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Ruler className="size-5" style={{ color: brand }} />
                  טבלת מידות
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label="סגירה"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      {parsed.headers.map((h, i) => (
                        <th
                          key={i}
                          className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-center font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.map((row, ri) => (
                      <tr key={ri}>
                        <th className="border border-zinc-200 bg-zinc-50 px-3 py-2 text-center font-semibold">
                          {row.size}
                        </th>
                        {Array.from({ length: valueCols }).map((_, ci) => (
                          <td
                            key={ci}
                            className="border border-zinc-200 px-3 py-2 text-center"
                          >
                            {row.cells[ci] ?? ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
