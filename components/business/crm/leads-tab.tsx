"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, UserPlus, ReceiptText, LayoutGrid, List, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { createLeadAction, updateLeadStatusAction, deleteLeadAction, convertLeadAction, loadMoreLeadsAction } from "@/lib/actions/crm";
import type { CrmLead, LeadStatus } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, quoteHref, useCrmNav } from "@/components/business/crm-dashboard";
import { LeadsBoard, LEAD_STATUS_LABEL, SOURCE_LABEL, isLeadConverted, LostReasonDialog } from "@/components/business/crm/leads-board";
import { usePaginatedList } from "@/components/business/crm/use-paginated-list";
import { ListToolbar } from "@/components/business/crm/list-toolbar";
import { StatusBadge } from "@/components/business/crm/status-badge";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

const CRM_PAGE_SIZE = 50;

type LeadSort = "newest" | "oldest" | "name";
const LEAD_SORT_LABEL: Record<LeadSort, string> = {
  newest: "חדשים קודם", oldest: "ישנים קודם", name: "לפי שם",
};

export function LeadsTab({ businessId, leads, onRefresh }: { businessId: string; leads: CrmLead[]; onRefresh: () => void }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [isPending, start] = useTransition();

  const { items: allLeads, hasMore, loading: loadingMore, loadMore } = usePaginatedList(leads, CRM_PAGE_SIZE);

  // ── Search / filter / sort (client-side over the currently-loaded page(s), list view only) ──
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<LeadSort>("newest");

  const distinctSources = useMemo(() => {
    const set = new Set<string>();
    for (const lead of allLeads) if (lead.source) set.add(lead.source);
    return [...set].sort();
  }, [allLeads]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = allLeads.filter((lead) => {
      if (statusFilter !== "all" && lead.status !== statusFilter) return false;
      if (sourceFilter !== "all" && lead.source !== sourceFilter) return false;
      if (q) {
        const haystack = [lead.name, lead.phone, lead.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        // Phone is stored E.164-normalized ("050-1234567" -> "+972501234567"), so also
        // compare the normalized form of the query against it for local-format searches.
        const phoneDigits = normalizePhoneForWhatsapp(q);
        const phoneMatch = phoneDigits ? (lead.phone ?? "").includes(phoneDigits) : false;
        if (!haystack.includes(q) && !phoneMatch) return false;
      }
      return true;
    });
    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name, "he");
      // created_at is an ISO timestamp — lexicographic compare is chronological
      if (sortBy === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
    return result;
  }, [allLeads, search, statusFilter, sourceFilter, sortBy]);

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createLeadAction(businessId, { name, phone: phone || undefined, email: email || undefined, source: source || undefined });
      if (res.error) toast.error(res.error);
      else {
        if (res.warning) toast.warning(res.warning);
        setName(""); setPhone(""); setEmail(""); setSource(""); onRefresh();
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* Add form */}
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="שם *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="טלפון" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="flex gap-2">
            <Input placeholder="מקור" value={source} onChange={(e) => setSource(e.target.value)} />
            <Button onClick={add} disabled={isPending || !name.trim()} size="icon">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            </Button>
          </div>
        </div>

        {allLeads.length === 0 ? (
          <EmptyState text="עדיין אין לידים" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg border p-0.5">
                <Button
                  variant={view === "board" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setView("board")}
                >
                  <LayoutGrid className="size-3.5" />
                  לוח
                </Button>
                <Button
                  variant={view === "list" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 gap-1.5 px-2.5 text-xs"
                  onClick={() => setView("list")}
                >
                  <List className="size-3.5" />
                  רשימה
                </Button>
              </div>
            </div>

            {view === "board" ? (
              <LeadsBoard leads={allLeads} businessId={businessId} onRefresh={onRefresh} />
            ) : (
              <>
                {/* Search / filter / sort toolbar */}
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <ListToolbar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="חיפוש לפי שם, טלפון או אימייל..."
                    filters={
                      distinctSources.length > 0
                        ? [{
                            value: sourceFilter,
                            onChange: setSourceFilter,
                            allLabel: "כל המקורות",
                            options: distinctSources.map((s) => ({ value: s, label: SOURCE_LABEL[s] ?? s })),
                          }]
                        : []
                    }
                    extra={
                      <Select value={sortBy} onValueChange={(v) => setSortBy(v as LeadSort)}>
                        <SelectTrigger className="sm:w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(LEAD_SORT_LABEL) as LeadSort[]).map((s) => (
                            <SelectItem key={s} value={s}>{LEAD_SORT_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                    exportBusinessId={businessId}
                    exportType="leads"
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant={statusFilter === "all" ? "default" : "outline"}
                      size="sm"
                      className="h-7 rounded-full px-3 text-xs"
                      onClick={() => setStatusFilter("all")}
                    >
                      הכל
                    </Button>
                    {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
                      <Button
                        key={s}
                        variant={statusFilter === s ? "default" : "outline"}
                        size="sm"
                        className="h-7 rounded-full px-3 text-xs"
                        onClick={() => setStatusFilter(s)}
                      >
                        {LEAD_STATUS_LABEL[s]}
                      </Button>
                    ))}
                    <span className="ms-auto text-xs text-muted-foreground">
                      {filteredLeads.length} מתוך {allLeads.length} לידים
                    </span>
                  </div>
                </div>

                {filteredLeads.length === 0 ? (
                  <EmptyState text="אין תוצאות לסינון הזה" />
                ) : (
                  <div className="space-y-2">
                    {filteredLeads.map((lead) => (
                      <LeadRow key={lead.id} lead={lead} businessId={businessId} onRefresh={onRefresh} />
                    ))}
                  </div>
                )}
              </>
            )}

            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={loadingMore}
                  onClick={() => loadMore((page) => loadMoreLeadsAction(businessId, page))}
                >
                  {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                  טען עוד
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function LeadRow({ lead, businessId, onRefresh }: { lead: CrmLead; businessId: string; onRefresh: () => void }) {
  const [isPending, start] = useTransition();
  const router = useRouter();
  const { quotes: showQuotes } = useCrmNav();
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  function changeStatus(status: LeadStatus) {
    if (status === "lost") { setLostDialogOpen(true); return; }
    start(async () => {
      await updateLeadStatusAction(businessId, lead.id, status);
      onRefresh();
    });
  }

  function confirmLost(reason: string) {
    setLostDialogOpen(false);
    start(async () => {
      await updateLeadStatusAction(businessId, lead.id, "lost", reason);
      onRefresh();
    });
  }

  function convert() {
    start(async () => {
      const res = await convertLeadAction(businessId, {
        id: lead.id, name: lead.name, phone: lead.phone, email: lead.email,
      });
      if (res.error) toast.error(res.error);
      else { toast.success(`${lead.name} נוסף ללקוחות 🎉`); onRefresh(); }
    });
  }

  function remove() {
    start(async () => {
      await deleteLeadAction(businessId, lead.id);
      onRefresh();
    });
  }

  const converted = isLeadConverted(lead);

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{lead.name}</span>
          {lead.source && (
            <Badge variant="secondary" className="text-[10px]">
              {SOURCE_LABEL[lead.source] ?? lead.source}
            </Badge>
          )}
          {converted && <StatusBadge tone="success" label="לקוח ✓" />}
        </div>
        <div className="text-xs text-muted-foreground">
          {[lead.phone, lead.email].filter(Boolean).join(" · ")}
        </div>
      </div>
      {showQuotes && (
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs"
          onClick={() => router.push(quoteHref(businessId, lead.name, lead.phone))}
          disabled={isPending} title="צור הצעת מחיר">
          <ReceiptText className="size-3.5" />
          הצעה
        </Button>
      )}
      {!converted && (
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs"
          onClick={convert} disabled={isPending} title="המר ללקוח">
          <UserPlus className="size-3.5" />
          המר ללקוח
        </Button>
      )}
      <Select value={lead.status} onValueChange={(v) => changeStatus(v as LeadStatus)}>
        <SelectTrigger className="h-7 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((s) => (
            <SelectItem key={s} value={s}>{LEAD_STATUS_LABEL[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive" onClick={remove} disabled={isPending}>
        <Trash2 className="size-3.5" />
      </Button>
      <LostReasonDialog
        open={lostDialogOpen}
        leadName={lead.name}
        onOpenChange={setLostDialogOpen}
        onConfirm={confirmLost}
      />
    </div>
  );
}
