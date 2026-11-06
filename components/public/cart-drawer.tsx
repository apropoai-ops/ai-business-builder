"use client";

import { useEffect, useState, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, X, Minus, Plus, Trash2, CheckCircle2, Loader2, Tag } from "lucide-react";

import { useCart, lineKey } from "@/components/public/cart-context";
import { submitCartOrderAction, startStoreCardCheckoutAction } from "@/lib/actions/orders";
import { validateCouponAction } from "@/lib/actions/coupon";
import { getCheckoutPrefillAction } from "@/lib/actions/customer-account";
import { trackAbandonedCartAction } from "@/lib/actions/abandoned-cart";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@/lib/payments";
import { resolveShipping, methodRegions, methodPoints, shippingTypeLabel } from "@/lib/shipping";
import type { ShippingMethod, Product } from "@/types/database";
import { inkOn } from "@/lib/storefront-brand";

export type CheckoutPayment = {
  methods: PaymentMethodKey[];
  bank: { bank?: string; branch?: string; account?: string; holder?: string } | null;
  bitPhone: string | null;
  paypalLink: string | null;
  cardLink: string | null;
  /** When true, the "card" method runs a real on-site Stripe checkout. */
  stripeCard?: boolean;
};

export function CartDrawer({
  slug,
  brand,
  shippingFee,
  freeThreshold,
  payment,
  shippingMethods = [],
  products,
}: {
  slug: string;
  brand: string;
  shippingFee?: number | null;
  freeThreshold?: number | null;
  payment?: CheckoutPayment;
  shippingMethods?: ShippingMethod[];
  products?: Product[];
}) {
  const { items, setQty, remove, clear, count, total, add } = useCart();
  const [open, setOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Structured shipping address — composed into one string for the order.
  const [country, setCountry] = useState("ישראל");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [streetNo, setStreetNo] = useState("");
  const [apt, setApt] = useState("");
  const [floor, setFloor] = useState("");
  // A saved address from the shopper's account (prefill) — used as-is unless
  // they fill the structured fields, which then take precedence.
  const [savedAddress, setSavedAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [hp, setHp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // A full-screen drawer that ignores Escape and lets the page scroll behind it
  // reads as a broken modal. Both are restored on close/unmount.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Payment method selection (only methods the merchant enabled).
  const enabledMethods = payment?.methods ?? [];
  const [method, setMethod] = useState<PaymentMethodKey | "">(enabledMethods[0] ?? "");
  const [placedMethod, setPlacedMethod] = useState<PaymentMethodKey | "">("");

  // Cross-sell: products from the same categories as the cart, in stock, not
  // already in the cart. Falls back to any in-stock products when no match.
  const recommendations = useMemo(() => {
    if (!products?.length || items.length === 0) return [] as Product[];
    const inCart = new Set(items.map((i) => i.productId));
    const cats = new Set(
      items
        .map((i) => products.find((p) => p.id === i.productId)?.category)
        .filter((c): c is string => Boolean(c)),
    );
    const eligible = products.filter((p) => p.in_stock && !inCart.has(p.id));
    const sameCat = eligible.filter((p) => p.category && cats.has(p.category));
    return (sameCat.length ? sameCat : eligible).slice(0, 4);
  }, [products, items]);

  function recoPrice(p: Product): number | null {
    if (p.sale_price != null && p.price != null && p.sale_price < p.price) return p.sale_price;
    return p.price;
  }
  function quickAddReco(p: Product) {
    const hasOptions = (p.sizes?.length ?? 0) > 0 || (p.colors?.length ?? 0) > 0 || p.track_inventory;
    if (hasOptions) {
      setOpen(false);
      document.getElementById("store")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    add({ productId: p.id, name: p.name, unitPrice: recoPrice(p), variant: null, variantId: null, image: p.image_url, engraving: null }, 1);
  }

  // Shipping method selection (when the merchant defined methods).
  const hasMethods = shippingMethods.length > 0;
  const [shipId, setShipId] = useState<string>(shippingMethods[0]?.id ?? "");
  const [shipRegion, setShipRegion] = useState<string>("");
  const [shipPoint, setShipPoint] = useState<string>("");
  const selectedShip = shippingMethods.find((m) => m.id === shipId) ?? null;

  // Loyalty (filled from checkout prefill for signed-in shoppers).
  const [loyalty, setLoyalty] = useState<{ points: number; value: number } | null>(null);
  const [redeem, setRedeem] = useState(false);


  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const discount = appliedCode ? Math.min(couponDiscount, total) : 0;
  const discountedSubtotal = Math.max(0, total - discount);

  // Loyalty redemption (display estimate; the server is authoritative).
  const loyaltyDiscount =
    redeem && loyalty && loyalty.value > 0
      ? Math.min(Math.round(loyalty.points * loyalty.value), discountedSubtotal)
      : 0;
  const merchAfter = Math.max(0, discountedSubtotal - loyaltyDiscount);

  // Legacy flat-fee shipping (used only when no shipping methods are defined).
  const fee = shippingFee ?? 0;
  const hasThreshold = freeThreshold != null && freeThreshold > 0;
  const qualifiesFree = hasThreshold && merchAfter >= freeThreshold;
  const legacyShipping = merchAfter > 0 && fee > 0 && !qualifiesFree ? fee : 0;

  // Method-based shipping (preferred when methods exist).
  const resolvedShip = selectedShip
    ? resolveShipping(selectedShip, { region: shipRegion, point: shipPoint }, merchAfter)
    : null;
  const shipValid = !hasMethods || resolvedShip !== null;
  const shipping = hasMethods ? resolvedShip?.price ?? 0 : legacyShipping;
  const grandTotal = merchAfter + shipping;
  const remainingForFree = hasThreshold ? Math.max(0, freeThreshold - merchAfter) : 0;

  // A delivery (ship-to-customer) method needs a real address; pickup doesn't.
  // Legacy flat-fee stores (no structured methods) ship physical goods too —
  // require an address there whenever a shipping fee applies.
  const needsAddress = hasMethods
    ? !!selectedShip && selectedShip.type !== "pickup" && selectedShip.type !== "pickup_point"
    : fee > 0;
  const structuredFilled =
    city.trim().length >= 2 && street.trim().length >= 2 && streetNo.trim().length >= 1;
  const address = structuredFilled
    ? [
        `${street.trim()} ${streetNo.trim()}`,
        apt.trim() && `דירה ${apt.trim()}`,
        floor.trim() && `קומה ${floor.trim()}`,
        city.trim(),
        country.trim() || "ישראל",
      ]
        .filter(Boolean)
        .join(", ")
    : savedAddress.trim();
  const addressValid = !needsAddress || address.trim().length >= 5;
  // One source for "why can't I submit?" — used both to disable the button and
  // to tell the customer what's missing.
  const submitBlockedReason =
    name.trim().length < 2
      ? "נא למלא שם מלא"
      : phone.replace(/\D/g, "").length < 9
        ? "נא למלא מספר טלפון תקין"
        : !shipValid
          ? "נא לבחור שיטת משלוח"
          : !addressValid
            ? "נא למלא כתובת מלאה למשלוח"
            : null;

  // Changing the cart invalidates a coupon (e.g. min-order) — clear it.
  function clearCoupon() {
    setAppliedCode(null);
    setCouponDiscount(0);
    setCouponMsg(null);
  }
  function changeQty(key: string, qty: number) {
    clearCoupon();
    setQty(key, qty);
  }
  function removeItem(key: string) {
    clearCoupon();
    remove(key);
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponBusy(true);
    setCouponMsg(null);
    const res = await validateCouponAction(slug, couponInput.trim(), total);
    if (res.ok && res.discount != null) {
      setAppliedCode(res.code ?? couponInput.trim().toUpperCase());
      setCouponDiscount(res.discount);
      setCouponMsg(null);
    } else {
      setAppliedCode(null);
      setCouponDiscount(0);
      setCouponMsg(res.error ?? "קוד לא תקין");
    }
    setCouponBusy(false);
  }

  // When the shopper proceeds to checkout, prefill from their saved account
  // details (default address → profile). No-op for guests.
  function proceedToCheckout() {
    setCheckout(true);
    getCheckoutPrefillAction(slug)
      .then((p) => {
        if (!p) return;
        setName((v) => v || p.name);
        setPhone((v) => v || p.phone);
        setSavedAddress((v) => v || p.address);
        setLoyalty(p.loyalty);
      })
      .catch(() => {});
  }

  // Record the in-progress cart for owner follow-up once a phone is entered.
  function trackCart() {
    if (phone.replace(/\D/g, "").length < 9 || items.length === 0) return;
    trackAbandonedCartAction(slug, {
      name: name || undefined,
      phone,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity })),
      total: grandTotal,
    }).catch(() => {});
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Real on-site card payment → redirect to Stripe Checkout. The order is
    // created pending and finalized by the webhook once payment succeeds.
    if (method === "card" && payment?.stripeCard) {
      startTransition(async () => {
        const res = await startStoreCardCheckoutAction(slug, {
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variant: i.variant, variantId: i.variantId, engraving: i.engraving })),
          name,
          phone,
          address: address || undefined,
          notes: notes || undefined,
          couponCode: appliedCode ?? undefined,
          shippingMethodId: hasMethods ? shipId || undefined : undefined,
          shippingRegion: shipRegion || undefined,
          shippingPoint: shipPoint || undefined,
          company_website: hp,
        });
        if (!res.ok || !res.url) setError(res.error ?? "פתיחת התשלום נכשלה");
        else window.location.href = res.url;
      });
      return;
    }

    startTransition(async () => {
      const res = await submitCartOrderAction(slug, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variant: i.variant, variantId: i.variantId, engraving: i.engraving })),
        name,
        phone,
        email: email || undefined,
        address: address || undefined,
        notes: notes || undefined,
        couponCode: appliedCode ?? undefined,
        paymentMethod: method || undefined,
        shippingMethodId: hasMethods ? shipId || undefined : undefined,
        shippingRegion: shipRegion || undefined,
        shippingPoint: shipPoint || undefined,
        redeemPoints: redeem || undefined,
        company_website: hp,
      });
      if (!res.ok) setError(res.error ?? "השליחה נכשלה — נסו שוב");
      else {
        setPlacedMethod(method);
        setDone(true);
        clear();
        clearCoupon();
        setCouponInput("");
      }
    });
  }

  return (
    <>
      {/* Header cart button (top-left of the site header) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="פתיחת סל הקניות"
        className="flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium transition-colors hover:bg-black/5"
        style={{ color: brand }}
      >
        {/* The count is anchored to the ICON, not to the button: the button
            also holds a label, so a badge positioned against it floated off
            beside the word instead of sitting on the cart. */}
        <span className="relative flex">
          <ShoppingCart className="size-5" />
          {count > 0 && (
            <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
              {count}
            </span>
          )}
        </span>
        <span className="hidden lg:inline">הסל</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="סל הקניות">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          {/* Panel — pinned to the LEFT, full height. Explicit dark text because
              the portal renders outside the page's text-color context. */}
          <div className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col bg-white text-zinc-900 shadow-2xl" dir="rtl" style={{ color: "#18181b" }}>
            <div className="flex items-center justify-between border-b p-4">
              <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: "#18181b" }}>
                <ShoppingCart className="size-5" style={{ color: brand }} />
                סל הקניות
              </h2>
              <button type="button" aria-label="סגירה" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100">
                <X className="size-5" />
              </button>
            </div>

            {done ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 overflow-y-auto p-8 text-center">
                <CheckCircle2 className="size-12" style={{ color: brand }} />
                <p className="text-lg font-semibold">ההזמנה התקבלה!</p>
                <p className="text-sm text-zinc-500">ניצור איתך קשר בהקדם לאישור ההזמנה.</p>

                <PaymentInstructions method={placedMethod} payment={payment} brand={brand} />

                <button
                  type="button"
                  onClick={() => {
                    setDone(false);
                    setCheckout(false);
                    setOpen(false);
                  }}
                  className="mt-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: brand, color: inkOn(brand) }}
                >
                  המשך לקנות
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-zinc-500">
                <ShoppingCart className="size-10 text-zinc-300" />
                הסל ריק — הוסיפו מוצרים מהחנות
              </div>
            ) : (
              // min-h-0 is what lets the inner list actually shrink; without
              // it the flex child refuses to scroll and the whole column does,
              // taking the totals and the checkout button off-screen with it.
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Items */}
                <div className="space-y-3 p-4">
                  {items.map((i) => {
                    const k = lineKey(i);
                    return (
                      <div key={k} className="flex gap-3 rounded-xl border p-2.5">
                        {i.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.image} alt={i.name} className="size-16 shrink-0 rounded-lg bg-zinc-50 object-contain p-1" />
                        ) : (
                          <div className="size-16 shrink-0 rounded-lg bg-zinc-100" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-semibold">{i.name}</div>
                            <button type="button" aria-label="הסרה" onClick={() => removeItem(k)} className="text-zinc-600 hover:text-red-600">
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                          {i.variant && <div className="text-xs text-zinc-500">{i.variant}</div>}
                          {i.engraving && (
                            <div className="truncate text-xs text-zinc-600" dir="auto">
                              ✒️ חריטה: {i.engraving}
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center justify-between">
                            <div className="flex items-center rounded-lg border border-zinc-200">
                              <button type="button" aria-label="הפחתה" onClick={() => changeQty(k, i.quantity - 1)} className="px-2 py-1 text-zinc-600 hover:bg-zinc-50">
                                <Minus className="size-3.5" />
                              </button>
                              <span className="min-w-7 text-center text-sm font-semibold">{i.quantity}</span>
                              <button type="button" aria-label="הוספה" onClick={() => changeQty(k, Math.min(99, i.quantity + 1))} className="px-2 py-1 text-zinc-600 hover:bg-zinc-50">
                                <Plus className="size-3.5" />
                              </button>
                            </div>
                            {i.unitPrice != null && (
                              <div className="text-sm font-bold" style={{ color: brand }}>
                                ₪{(i.unitPrice * i.quantity).toLocaleString("he-IL")}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Cross-sell recommendations */}
                {recommendations.length > 0 && !checkout && (
                  <div className="border-t p-4">
                    <div className="mb-2 text-xs font-semibold text-zinc-500">שדרגו את ההזמנה</div>
                    <div className="grid grid-cols-2 gap-2">
                      {recommendations.map((p) => {
                        const eff = recoPrice(p);
                        return (
                          <div key={p.id} className="flex flex-col gap-1 rounded-xl border p-2">
                            <div className="flex items-center gap-2">
                              {p.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.image_url} alt={p.name} className="size-10 shrink-0 rounded-lg bg-zinc-50 object-contain" />
                              ) : (
                                <div className="size-10 shrink-0 rounded-lg bg-zinc-100" />
                              )}
                              <div className="min-w-0">
                                <div className="truncate text-xs font-medium">{p.name}</div>
                                {eff != null && (
                                  <div className="text-xs font-bold" style={{ color: brand }}>
                                    ₪{eff.toLocaleString("he-IL")}
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => quickAddReco(p)}
                              className="rounded-lg border px-2 py-1 text-xs font-medium"
                              style={{ borderColor: brand, color: brand }}
                            >
                              {((p.sizes?.length ?? 0) > 0 || (p.colors?.length ?? 0) > 0 || p.track_inventory) ? "לצפייה" : "+ הוספה"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                </div>
                {/* Footer: totals + checkout — pinned, never scrolls away */}
                <div className="shrink-0 space-y-3 border-t bg-white p-4">
                  {/* Free-shipping progress hint (legacy flat-fee only) */}
                  {!hasMethods && hasThreshold && remainingForFree > 0 && fee > 0 && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      הוסיפו עוד ₪{remainingForFree.toLocaleString("he-IL")} למשלוח חינם! 🚚
                    </p>
                  )}
                  {!hasMethods && qualifiesFree && fee > 0 && (
                    <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                      מזל טוב — זכאים למשלוח חינם! 🎉
                    </p>
                  )}

                  {/* Coupon */}
                  {appliedCode ? (
                    <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-green-700">
                        <Tag className="size-3.5" /> קופון {appliedCode} הופעל
                      </span>
                      <button type="button" onClick={clearCoupon} className="text-xs text-zinc-500 underline-offset-2 hover:underline">
                        הסרה
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex gap-2">
                        <input
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value)}
                          placeholder="קוד קופון"
                          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm uppercase outline-none"
                        />
                        <button
                          type="button"
                          onClick={applyCoupon}
                          disabled={couponBusy || !couponInput.trim()}
                          className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-50"
                          style={{ borderColor: brand, color: brand }}
                        >
                          {couponBusy ? <Loader2 className="size-4 animate-spin" /> : "החל"}
                        </button>
                      </div>
                      {couponMsg && <p className="mt-1 text-xs text-red-600">{couponMsg}</p>}
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between text-zinc-600">
                      <span>מוצרים</span>
                      <span>₪{total.toLocaleString("he-IL")}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex items-center justify-between text-green-700">
                        <span>הנחה ({appliedCode})</span>
                        <span>−₪{discount.toLocaleString("he-IL")}</span>
                      </div>
                    )}
                    {loyaltyDiscount > 0 && (
                      <div className="flex items-center justify-between text-green-700">
                        <span>מימוש נקודות</span>
                        <span>−₪{loyaltyDiscount.toLocaleString("he-IL")}</span>
                      </div>
                    )}
                    {(hasMethods ? !!selectedShip : fee > 0) && (
                      <div className="flex items-center justify-between text-zinc-600">
                        <span>משלוח{hasMethods && selectedShip ? ` · ${selectedShip.name}` : ""}</span>
                        <span>{shipping === 0 ? "חינם" : `₪${shipping.toLocaleString("he-IL")}`}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 text-base font-bold">
                    <span>סה״כ</span>
                    <span style={{ color: brand }}>₪{grandTotal.toLocaleString("he-IL")}</span>
                  </div>

                  {!checkout ? (
                    <button
                      type="button"
                      onClick={proceedToCheckout}
                      className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: brand, color: inkOn(brand) }}
                    >
                      למעבר לתשלום
                    </button>
                  ) : (
                    <form onSubmit={submit} className="space-y-2.5">
                      <input
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        value={hp}
                        onChange={(e) => setHp(e.target.value)}
                        style={{ position: "absolute", left: "-9999px", width: 0, height: 0, opacity: 0 }}
                      />
                      {loyalty && loyalty.points > 0 && loyalty.value > 0 && (
                        <label className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <input type="checkbox" checked={redeem} onChange={(e) => setRedeem(e.target.checked)} className="size-4" />
                          מימוש {loyalty.points} נקודות (₪{Math.round(loyalty.points * loyalty.value).toLocaleString("he-IL")} הנחה)
                        </label>
                      )}
                      {hasMethods && (
                        <div>
                          <div className="mb-1.5 text-xs font-medium text-zinc-500">שיטת משלוח</div>
                          <div className="space-y-1.5">
                            {shippingMethods.map((m) => {
                              const sel = shipId === m.id;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => { setShipId(m.id); setShipRegion(""); setShipPoint(""); }}
                                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                                    sel ? "text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                  }`}
                                  style={sel ? { backgroundColor: brand, borderColor: brand , color: inkOn(brand) } : undefined}
                                >
                                  <span className="flex flex-col items-start">
                                    <span className="font-medium">{m.name}</span>
                                    <span className={`text-xs ${sel ? "text-white/80" : "text-zinc-600"}`}>
                                      {shippingTypeLabel(m.type)}{m.eta ? ` · ${m.eta}` : ""}
                                    </span>
                                  </span>
                                  <span className="font-semibold">
                                    {Number(m.price) === 0 ? "חינם" : `₪${Number(m.price).toLocaleString("he-IL")}`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          {/* By-region sub-select */}
                          {selectedShip?.type === "by_region" && methodRegions(selectedShip).length > 0 && (
                            <select
                              value={shipRegion}
                              onChange={(e) => setShipRegion(e.target.value)}
                              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="">בחרו אזור…</option>
                              {methodRegions(selectedShip).map((r) => (
                                <option key={r.name} value={r.name}>
                                  {r.name} — ₪{r.price.toLocaleString("he-IL")}
                                </option>
                              ))}
                            </select>
                          )}
                          {/* Pickup-point sub-select */}
                          {selectedShip?.type === "pickup_point" && methodPoints(selectedShip).length > 0 && (
                            <select
                              value={shipPoint}
                              onChange={(e) => setShipPoint(e.target.value)}
                              className="mt-2 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                            >
                              <option value="">בחרו נקודת איסוף…</option>
                              {methodPoints(selectedShip).map((p) => (
                                <option key={p.name} value={p.name}>
                                  {p.name}{p.address ? ` — ${p.address}` : ""}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                      {enabledMethods.length > 0 && (
                        <div>
                          <div className="mb-1.5 text-xs font-medium text-zinc-500">אמצעי תשלום</div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {PAYMENT_METHODS.filter((m) => enabledMethods.includes(m.key)).map((m) => (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => setMethod(m.key)}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                                  method === m.key ? "text-white" : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                                }`}
                                style={method === m.key ? { backgroundColor: brand, borderColor: brand , color: inkOn(brand) } : undefined}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* aria-label on every field: a placeholder is not an
                          accessible name, and it disappears as soon as the
                          customer starts typing. */}
                      <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="שם מלא *" aria-label="שם מלא (חובה)" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
                      <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="טלפון *" aria-label="טלפון (חובה)" autoComplete="tel" dir="auto" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={trackCart} required />
                      <input className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="אימייל לאישור הזמנה (מומלץ)" aria-label="אימייל לאישור הזמנה" autoComplete="email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
                      {/* Structured shipping address (composed into one string for the order) */}
                      <div className="space-y-2 rounded-xl border border-zinc-100 p-3">
                        <p className="text-xs font-semibold text-zinc-600">
                          {needsAddress ? "כתובת למשלוח *" : "כתובת למשלוח (אופציונלי)"}
                        </p>
                        {savedAddress && !structuredFilled && (
                          <p className="rounded-lg bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-500">
                            נשתמש בכתובת השמורה שלך: {savedAddress} — או מלאו כתובת אחרת:
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={needsAddress ? "עיר *" : "עיר"} aria-label="עיר" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="מדינה" aria-label="מדינה" autoComplete="country-name" value={country} onChange={(e) => setCountry(e.target.value)} />
                          {/* A street name needs the room; a house number doesn't. */}
                          <input className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm sm:col-span-1" placeholder={needsAddress ? "רחוב *" : "רחוב"} aria-label="רחוב" autoComplete="address-line1" value={street} onChange={(e) => setStreet(e.target.value)} />
                          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder={needsAddress ? "מספר *" : "מספר"} aria-label="מספר בית" inputMode="numeric" value={streetNo} onChange={(e) => setStreetNo(e.target.value)} />
                          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="דירה (אופציונלי)" aria-label="דירה" value={apt} onChange={(e) => setApt(e.target.value)} />
                          <input className="rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="קומה / קרקע (אופציונלי)" aria-label="קומה" value={floor} onChange={(e) => setFloor(e.target.value)} />
                        </div>
                        {needsAddress && !addressValid && (city || street || streetNo) ? (
                          <p className="text-xs text-amber-600">נא למלא עיר, רחוב ומספר</p>
                        ) : null}
                      </div>
                      <textarea className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm" placeholder="הערות (אופציונלי)" aria-label="הערות להזמנה" rows={2} maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
                      {error && (
                        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {error}
                        </p>
                      )}
                      {/* Say WHY it's disabled — a greyed-out button with no
                          explanation is where an order quietly dies. */}
                      {!isPending && submitBlockedReason && (
                        <p className="text-xs text-zinc-500">{submitBlockedReason}</p>
                      )}
                      <button
                        type="submit"
                        disabled={isPending || Boolean(submitBlockedReason)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        style={{ backgroundColor: brand, color: inkOn(brand) }}
                      >
                        {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {method === "card" && payment?.stripeCard ? "מעבר לתשלום מאובטח" : "שליחת הזמנה"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Post-order payment instructions shown on the confirmation screen. */
function PaymentInstructions({
  method,
  payment,
  brand,
}: {
  method: PaymentMethodKey | "";
  payment?: CheckoutPayment;
  brand: string;
}) {
  if (!method || !payment) return null;

  const box = "mt-1 w-full rounded-xl border bg-zinc-50 p-4 text-start text-sm";

  if (method === "cod") {
    return <div className={box}>💵 התשלום יתבצע במזומן בעת קבלת ההזמנה.</div>;
  }

  if (method === "bit") {
    return (
      <div className={box}>
        <div className="mb-1 font-semibold">תשלום ב-Bit</div>
        {payment.bitPhone ? (
          <p>
            שלחו את סכום ההזמנה ב-Bit למספר{" "}
            <span dir="ltr" className="font-bold">{payment.bitPhone}</span> וציינו את שמכם.
          </p>
        ) : (
          <p>ניצור איתכם קשר עם פרטי התשלום ב-Bit.</p>
        )}
      </div>
    );
  }

  if (method === "bank_transfer") {
    const b = payment.bank;
    return (
      <div className={box}>
        <div className="mb-1 font-semibold">העברה בנקאית</div>
        {b && (b.bank || b.account) ? (
          // dir="ltr" belongs on the NUMBERS, not the whole list — on the list
          // it flipped the Hebrew labels to left-aligned with the colon in the
          // wrong place.
          <ul className="space-y-0.5">
            {b.bank && <li>בנק: {b.bank}</li>}
            {b.branch && <li>סניף: <span dir="ltr" className="inline-block">{b.branch}</span></li>}
            {b.account && <li>חשבון: <span dir="ltr" className="inline-block font-mono">{b.account}</span></li>}
            {b.holder && <li>ע״ש: {b.holder}</li>}
          </ul>
        ) : (
          <p>ניצור איתכם קשר עם פרטי החשבון להעברה.</p>
        )}
      </div>
    );
  }

  // card / paypal → external link
  const link = method === "paypal" ? payment.paypalLink : payment.cardLink;
  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="mt-1 w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: brand, color: inkOn(brand) }}
      >
        {method === "paypal" ? "המשך לתשלום ב-PayPal" : "המשך לתשלום מאובטח"}
      </a>
    );
  }
  return <div className={box}>ניצור איתכם קשר להשלמת התשלום.</div>;
}
