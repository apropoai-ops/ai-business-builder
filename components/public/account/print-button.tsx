"use client";

import { Printer } from "lucide-react";

/** Triggers the browser print dialog (for invoices / receipts). */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
    >
      <Printer className="size-4" />
      הדפסה / שמירה כ-PDF
    </button>
  );
}
