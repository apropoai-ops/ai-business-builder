"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExportCsvLink } from "@/components/business/crm-dashboard";

export type ToolbarFilter = {
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
  widthClassName?: string;
};

/**
 * The search + filter dropdown(s) + export combo shared by the leads and
 * customers tabs (previously hand-copied in each). Status/tag filter chips
 * stay in the calling tab — those differ enough per domain (fixed status
 * enum vs. free-form tags) that folding them in here would force an
 * artificial shared shape.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "חיפוש...",
  filters = [],
  extra,
  exportBusinessId,
  exportType,
  countLabel,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ToolbarFilter[];
  /** A control that isn't a reset-able filter (e.g. a sort dropdown), rendered after the filter selects. */
  extra?: React.ReactNode;
  exportBusinessId?: string;
  exportType?: "leads" | "customers";
  /** Pre-formatted "X מתוך Y ..." counter, rendered at the end of the row. */
  countLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1 sm:max-w-xs">
        <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pe-9"
        />
      </div>
      {filters.map((f, i) => (
        <Select key={i} value={f.value} onValueChange={(v) => f.onChange(v ?? "all")}>
          <SelectTrigger className={f.widthClassName ?? "sm:w-36"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{f.allLabel}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
      {extra}
      <div className="flex items-center gap-3 sm:ms-auto">
        {countLabel && <span className="text-xs text-muted-foreground">{countLabel}</span>}
        {exportBusinessId && exportType && <ExportCsvLink businessId={exportBusinessId} type={exportType} />}
      </div>
    </div>
  );
}
