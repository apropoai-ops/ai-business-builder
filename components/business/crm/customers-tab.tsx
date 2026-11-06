"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, ReceiptText, IdCard, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { createCustomerAction, deleteCustomerAction, loadMoreCustomersAction } from "@/lib/actions/crm";
import type { CrmCustomer } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CustomerCard } from "@/components/business/customer-card";
import { EmptyState, quoteHref, useCrmNav } from "@/components/business/crm-dashboard";
import { usePaginatedList } from "@/components/business/crm/use-paginated-list";
import { ListToolbar } from "@/components/business/crm/list-toolbar";
import { StatusBadge } from "@/components/business/crm/status-badge";
import { normalizePhoneForWhatsapp } from "@/lib/phone";

const CRM_PAGE_SIZE = 50;

/** true when `birthday` (MM-DD, year ignored) falls today or within the current calendar month. */
function birthdayBadge(birthday: string | null): "today" | "month" | null {
  if (!birthday) return null;
  const parts = birthday.split("-");
  if (parts.length !== 3) return null;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!month || !day) return null;
  const now = new Date();
  if (month !== now.getMonth() + 1) return null;
  return day === now.getDate() ? "today" : "month";
}

export function CustomersTab({ businessId, customers, onRefresh }: { businessId: string; customers: CrmCustomer[]; onRefresh: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPending, start] = useTransition();

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [cardOpen, setCardOpen] = useState(false);

  const { items: allCustomers, hasMore, loading: loadingMore, loadMore } = usePaginatedList(customers, CRM_PAGE_SIZE);

  const distinctTags = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCustomers) for (const t of c.tags ?? []) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "he"));
  }, [allCustomers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCustomers.filter((c) => {
      if (tagFilter && !(c.tags ?? []).includes(tagFilter)) return false;
      if (q) {
        const haystack = [c.name, c.phone, c.email].filter(Boolean).join(" ").toLowerCase();
        // Phone is stored E.164-normalized ("050-1234567" -> "+972501234567"), so also
        // compare the normalized form of the query against it for local-format searches.
        const phoneDigits = normalizePhoneForWhatsapp(q);
        const phoneMatch = phoneDigits ? (c.phone ?? "").includes(phoneDigits) : false;
        if (!haystack.includes(q) && !phoneMatch) return false;
      }
      return true;
    });
  }, [allCustomers, search, tagFilter]);

  function add() {
    if (!name.trim()) return;
    start(async () => {
      const res = await createCustomerAction(businessId, { name, phone: phone || undefined, email: email || undefined });
      if (res.error) toast.error(res.error);
      else { setName(""); setPhone(""); setEmail(""); onRefresh(); }
    });
  }

  function openCard(customer: CrmCustomer) {
    setSelected(customer);
    setCardOpen(true);
  }

  // Keep the sheet showing the latest server data for the selected customer
  // (e.g. right after a save) without re-fetching insights — the row list
  // already carries the fresh customer object post-refresh.
  const selectedLive = selected ? allCustomers.find((c) => c.id === selected.id) ?? selected : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="grid gap-2 sm:grid-cols-4">
          <Input placeholder="שם *" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="טלפון" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="אימייל" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={add} disabled={isPending || !name.trim()}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            הוסף לקוח
          </Button>
        </div>

        {allCustomers.length === 0 ? (
          <EmptyState text="עדיין אין לקוחות" />
        ) : (
          <>
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="חיפוש לפי שם, טלפון או אימייל..."
              countLabel={`${filteredCustomers.length} מתוך ${allCustomers.length} לקוחות`}
              exportBusinessId={businessId}
              exportType="customers"
            />

            {distinctTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant={tagFilter === null ? "default" : "outline"}
                  size="sm"
                  className="h-7 rounded-full px-3 text-xs"
                  onClick={() => setTagFilter(null)}
                >
                  כל התגיות
                </Button>
                {distinctTags.map((tag) => (
                  <Button
                    key={tag}
                    variant={tagFilter === tag ? "default" : "outline"}
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            )}

            {filteredCustomers.length === 0 ? (
              <EmptyState text="אין תוצאות לסינון הזה" />
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map((c) => (
                  <CustomerRow key={c.id} customer={c} businessId={businessId} onRefresh={onRefresh} onOpenCard={openCard} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="flex justify-center pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={loadingMore}
                  onClick={() => loadMore((page) => loadMoreCustomersAction(businessId, page))}
                >
                  {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : <ChevronDown className="size-3.5" />}
                  טען עוד
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>

      <CustomerCard
        customer={selectedLive}
        businessId={businessId}
        open={cardOpen}
        onOpenChange={setCardOpen}
        onSaved={onRefresh}
      />
    </Card>
  );
}

function CustomerRow({ customer, businessId, onRefresh, onOpenCard }: {
  customer: CrmCustomer;
  businessId: string;
  onRefresh: () => void;
  onOpenCard: (customer: CrmCustomer) => void;
}) {
  const [isPending, start] = useTransition();
  const router = useRouter();
  const { quotes: showQuotes } = useCrmNav();
  function remove() {
    start(async () => { await deleteCustomerAction(businessId, customer.id); onRefresh(); });
  }
  const birthday = birthdayBadge(customer.birthday);
  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40"
      onClick={() => onOpenCard(customer)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpenCard(customer); }}
    >
      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
        {customer.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{customer.name}</span>
          {birthday === "today" && <StatusBadge tone="warning" label="🎂 היום" />}
          {birthday === "month" && <Badge variant="secondary" className="text-[10px]">🎂 החודש</Badge>}
          {(customer.tags ?? []).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          {[customer.phone, customer.email].filter(Boolean).join(" · ")}
        </div>
      </div>
      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs"
        onClick={(e) => { e.stopPropagation(); onOpenCard(customer); }}
        disabled={isPending} title="כרטיס לקוח">
        <IdCard className="size-3.5" />
        כרטיס לקוח
      </Button>
      {showQuotes && (
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); router.push(quoteHref(businessId, customer.name, customer.phone)); }}
          disabled={isPending} title="צור הצעת מחיר">
          <ReceiptText className="size-3.5" />
          הצעה
        </Button>
      )}
      <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); remove(); }} disabled={isPending}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
