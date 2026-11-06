"use client";

import { useState, useTransition } from "react";
import {
  Phone, Mail, MessageCircle, Loader2, X, Plus, Save,
  CalendarClock, History, ReceiptText, UserCog, Cake, ShoppingBag,
  Activity, Copy,
} from "lucide-react";
import { toast } from "sonner";

import { updateCustomerProfileAction, getCustomerInsightsAction, draftFollowupAction, logFollowupSentAction } from "@/lib/actions/crm";
import type { CrmCustomer } from "@/types/database";
import type { CustomerInsights } from "@/lib/services/customer-insights.service";
import { buildWaMeUrl } from "@/lib/phone";
import { CustomerTimeline } from "@/components/business/crm/customer-timeline";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: "ממתין",
  confirmed: "אושר",
  cancelled: "בוטל",
  blocked: "חסום",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", { dateStyle: "short" });
}

/** Short Hebrew context line handed to the AI as grounding for the follow-up draft. */
function buildFollowupContext(insights: CustomerInsights | null): string {
  if (!insights || insights.visits === 0) return "לקוח חדש";
  const lastVisit = insights.lastVisit ? formatDate(insights.lastVisit) : "לא ידוע";
  return `לקוח קבוע, ${insights.visits} ביקורים, ביקור אחרון ${lastVisit}`;
}

/**
 * Full customer card — opened via `open()` returned from the hook below.
 * Insights are fetched once when the sheet opens (not in a useEffect), so
 * there's no setState-in-effect and no wasted fetch while closed.
 */
export function CustomerCard({
  customer,
  businessId,
  open,
  onOpenChange,
  onSaved,
}: {
  customer: CrmCustomer | null;
  businessId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [insights, setInsights] = useState<CustomerInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);

  const [followupOpen, setFollowupOpen] = useState(false);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [followupText, setFollowupText] = useState("");
  const [followupEmail, setFollowupEmail] = useState<{ subject: string; body: string } | null>(null);

  // Fetch on the open transition itself (triggered from handleOpenChange),
  // never from a useEffect — avoids react-hooks/set-state-in-effect.
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (next && customer && loadedForId !== customer.id) {
      setInsightsLoading(true);
      setInsights(null);
      setLoadedForId(customer.id);
      getCustomerInsightsAction(businessId, { phone: customer.phone, email: customer.email })
        .then((res) => {
          if (res.error) toast.error(res.error);
          setInsights(res.data ?? null);
        })
        .finally(() => setInsightsLoading(false));
    }
  }

  // Fires from the "הודעת מעקב" button click — an event handler, not an
  // effect — so this mirrors the same non-effect fetch pattern as above.
  function openFollowup() {
    if (!customer) return;
    setFollowupOpen(true);
    setFollowupLoading(true);
    setFollowupError(null);
    setFollowupText("");
    setFollowupEmail(null);
    draftFollowupAction(businessId, {
      name: customer.name,
      context: buildFollowupContext(insights),
      email: customer.email,
      customerId: customer.id,
    })
      .then((res) => {
        if (!res.ok) { setFollowupError(res.error ?? "שגיאה ביצירת ההודעה"); return; }
        setFollowupText(res.text ?? "");
        setFollowupEmail(res.email ?? null);
      })
      .finally(() => setFollowupLoading(false));
  }

  function copyFollowup() {
    if (!followupText) return;
    navigator.clipboard.writeText(followupText);
    toast.success("הטקסט הועתק");
    logFollowupSentAction(businessId, { customerId: customer!.id }, "copy");
  }

  function copyFollowupEmail() {
    if (!followupEmail) return;
    navigator.clipboard.writeText(`${followupEmail.subject}\n\n${followupEmail.body}`);
    toast.success("הטקסט הועתק");
    logFollowupSentAction(businessId, { customerId: customer!.id }, "copy");
  }

  function logSent(channel: "whatsapp" | "email") {
    if (!customer) return;
    logFollowupSentAction(businessId, { customerId: customer.id }, channel);
  }

  if (!customer) return null;

  const waHref = customer.phone ? buildWaMeUrl(customer.phone) : null;
  const waFollowupHref = customer.phone && followupText ? buildWaMeUrl(customer.phone, followupText) : null;
  const mailtoFollowupHref = customer.email && followupEmail
    ? `mailto:${customer.email}?subject=${encodeURIComponent(followupEmail.subject)}&body=${encodeURIComponent(followupEmail.body)}`
    : null;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" dir="rtl">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <Avatar size="lg">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {customer.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">{customer.name}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {customer.phone && (
                  <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Phone className="size-3" />{customer.phone}
                  </a>
                )}
                {customer.email && (
                  <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Mail className="size-3" />{customer.email}
                  </a>
                )}
              </SheetDescription>
            </div>
          </div>
          {customer.tags && customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-600/20 dark:text-green-400"
              >
                <MessageCircle className="size-3.5" />
                וואטסאפ
              </a>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto rounded-lg px-2.5 py-1 text-xs"
              onClick={openFollowup}
            >
              ✨ הודעת מעקב
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-4">
          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <QuickStat label="ביקורים" value={insightsLoading ? "…" : (insights?.visits ?? 0)} />
            <QuickStat label="לא הגיע" value={insightsLoading ? "…" : (insights?.noShows ?? 0)} warn={!!insights?.noShows} />
            <QuickStat label="הזמנות" value={insightsLoading ? "…" : (insights?.ordersCount ?? 0)} />
            <QuickStat
              label="סה״כ קניות"
              value={insightsLoading ? "…" : `₪${(insights?.totalSpent ?? 0).toLocaleString()}`}
            />
          </div>

          {insights?.upcoming && (
            <div className="flex items-center gap-2 rounded-lg border bg-primary/5 p-2.5 text-sm">
              <CalendarClock className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate">
                תור קרוב: {insights.upcoming.service ?? "—"} · {formatDateTime(insights.upcoming.starts_at)}
              </span>
            </div>
          )}

          <Tabs defaultValue="timeline" dir="rtl">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="timeline" className="gap-1.5 text-xs"><Activity className="size-3.5" />ציר זמן</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="size-3.5" />ביקורים</TabsTrigger>
              <TabsTrigger value="orders" className="gap-1.5 text-xs"><ShoppingBag className="size-3.5" />הזמנות</TabsTrigger>
              <TabsTrigger value="details" className="gap-1.5 text-xs"><UserCog className="size-3.5" />פרטים</TabsTrigger>
            </TabsList>

            <TabsContent value="timeline" className="pt-3">
              <CustomerTimeline businessId={businessId} customerId={customer.id} insights={insights} />
            </TabsContent>

            <TabsContent value="history" className="pt-3">
              <HistoryTab loading={insightsLoading} bookings={insights?.recentBookings ?? []} />
            </TabsContent>

            <TabsContent value="orders" className="pt-3">
              <OrdersTab loading={insightsLoading} orders={insights?.recentOrders ?? []} />
            </TabsContent>

            <TabsContent value="details" className="pt-3">
              <DetailsTab
                customer={customer}
                businessId={businessId}
                onSaved={onSaved}
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
      </Sheet>

      <Dialog open={followupOpen} onOpenChange={setFollowupOpen}>
        <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>הודעת מעקב ל{customer.name}</DialogTitle>
          <DialogDescription>טיוטת AI — אפשר לערוך לפני שליחה.</DialogDescription>
        </DialogHeader>

        {followupLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : followupError ? (
          <p className="py-4 text-center text-sm text-destructive">{followupError}</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MessageCircle className="size-3.5" />
                וואטסאפ
              </div>
              <Textarea
                value={followupText}
                onChange={(e) => setFollowupText(e.target.value)}
                rows={5}
                className="text-sm"
              />
            </div>
            {followupEmail && (
              <div className="space-y-1.5 rounded-lg border bg-muted/30 p-2.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Mail className="size-3.5" />
                  אימייל
                </div>
                <Input
                  value={followupEmail.subject}
                  onChange={(e) => setFollowupEmail({ ...followupEmail, subject: e.target.value })}
                  className="text-sm"
                />
                <Textarea
                  value={followupEmail.body}
                  onChange={(e) => setFollowupEmail({ ...followupEmail, body: e.target.value })}
                  rows={4}
                  className="text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copyFollowupEmail}>
                    <Copy className="size-3.5" />
                    העתקה
                  </Button>
                  {mailtoFollowupHref && (
                    <a
                      href={mailtoFollowupHref}
                      onClick={() => logSent("email")}
                      className={buttonVariants({ variant: "default", size: "sm", className: "gap-1.5" })}
                    >
                      <Mail className="size-3.5" />
                      שליחה באימייל
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5"
            disabled={!followupText}
            onClick={copyFollowup}
          >
            <Copy className="size-3.5" />
            העתקה
          </Button>
          {waFollowupHref && (
            <a
              href={waFollowupHref}
              target="_blank"
              rel="noreferrer"
              onClick={() => logSent("whatsapp")}
              className={buttonVariants({ variant: "default", className: "gap-1.5" })}
            >
              <MessageCircle className="size-3.5" />
              שליחה בוואטסאפ
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

function QuickStat({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${warn ? "border-destructive/30 bg-destructive/5" : "bg-muted/30"}`}>
      <div className={`text-base font-bold leading-none ${warn ? "text-destructive" : ""}`}>{value}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function HistoryTab({ loading, bookings }: { loading: boolean; bookings: CustomerInsights["recentBookings"] }) {
  if (loading) return <LoadingRows />;
  if (bookings.length === 0) return <EmptyMini text="אין היסטוריית ביקורים" />;
  return (
    <div className="space-y-1.5">
      {bookings.map((b) => (
        <div key={b.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{b.service ?? "—"}</div>
            <div className="text-xs text-muted-foreground">{formatDateTime(b.starts_at)}</div>
          </div>
          {b.no_show ? (
            <Badge variant="destructive" className="text-[10px]">לא הגיע</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">{BOOKING_STATUS_LABEL[b.status] ?? b.status}</Badge>
          )}
        </div>
      ))}
    </div>
  );
}

function OrdersTab({ loading, orders }: { loading: boolean; orders: CustomerInsights["recentOrders"] }) {
  if (loading) return <LoadingRows />;
  if (orders.length === 0) return <EmptyMini text="אין הזמנות" />;
  return (
    <div className="space-y-1.5">
      {orders.map((o) => (
        <div key={o.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
          <ReceiptText className="size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">₪{o.total.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">{formatDate(o.created_at)}</div>
          </div>
          <Badge variant="outline" className="text-[10px]">{o.payment_status || o.status}</Badge>
        </div>
      ))}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="flex items-center justify-center py-8 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Details tab — editable profile form
// ─────────────────────────────────────────────────────────────────────────────
function DetailsTab({
  customer,
  businessId,
  onSaved,
}: {
  customer: CrmCustomer;
  businessId: string;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [birthday, setBirthday] = useState(customer.birthday ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [tags, setTags] = useState<string[]>(customer.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [isPending, start] = useTransition();

  function addTag() {
    const v = tagInput.trim();
    if (!v || tags.length >= 10 || tags.includes(v)) { setTagInput(""); return; }
    setTags([...tags, v]);
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function save() {
    if (!name.trim()) { toast.error("שם חובה"); return; }
    start(async () => {
      const res = await updateCustomerProfileAction(customer.id, businessId, {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
        tags,
        birthday: birthday || null,
      });
      if (res.error) toast.error(res.error);
      else { toast.success("הפרטים נשמרו"); onSaved(); }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cc-name">שם</Label>
        <Input id="cc-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="cc-phone">טלפון</Label>
          <Input id="cc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cc-email">אימייל</Label>
          <Input id="cc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cc-birthday" className="gap-1.5"><Cake className="size-3.5" />יום הולדת</Label>
        <Input id="cc-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>תגיות</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-[11px]">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-destructive" aria-label={`הסר תגית ${tag}`}>
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        {tags.length < 10 && (
          <div className="flex gap-1.5">
            <Input
              placeholder="תגית חדשה..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
              className="h-8 text-sm"
            />
            <Button type="button" variant="outline" size="icon" className="size-8 shrink-0" onClick={addTag}>
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cc-notes">הערות</Label>
        <Textarea id="cc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
      </div>

      <Button onClick={save} disabled={isPending || !name.trim()} className="w-full gap-1.5">
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        שמור שינויים
      </Button>
    </div>
  );
}
