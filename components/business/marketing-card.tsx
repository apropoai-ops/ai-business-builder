"use client";

import { useState, useTransition } from "react";
import { Megaphone, Gift, Loader2, Check, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { setPopupSettingsAction, setLoyaltySettingsAction, setReferralSettingsAction } from "@/lib/actions/marketing";
import type { Business } from "@/types/database";

/** Owner config for the storefront popup + the loyalty points program. */
export function MarketingCard({ business }: { business: Business }) {
  const [pEnabled, setPEnabled] = useState(business.popup_enabled);
  const [pTitle, setPTitle] = useState(business.popup_title ?? "");
  const [pText, setPText] = useState(business.popup_text ?? "");
  const [pCoupon, setPCoupon] = useState(business.popup_coupon ?? "");

  const [lEnabled, setLEnabled] = useState(business.loyalty_enabled);
  const [lEarn, setLEarn] = useState(String(business.loyalty_earn ?? 1));
  const [lValue, setLValue] = useState(String(business.loyalty_value ?? 0.1));

  const [rEnabled, setREnabled] = useState(business.referral_enabled);
  const [rPoints, setRPoints] = useState(String(business.referral_points ?? 50));

  const [isPending, startTransition] = useTransition();

  function savePopup() {
    startTransition(async () => {
      const res = await setPopupSettingsAction(business.id, {
        enabled: pEnabled, title: pTitle, text: pText, coupon: pCoupon,
      });
      if (res.ok) toast.success("הפופאפ נשמר ✓");
      else toast.error(res.error ?? "שגיאה");
    });
  }
  function saveLoyalty() {
    startTransition(async () => {
      const res = await setLoyaltySettingsAction(business.id, { enabled: lEnabled, earn: lEarn, value: lValue });
      if (res.ok) toast.success("תוכנית הנאמנות נשמרה ✓");
      else toast.error(res.error ?? "שגיאה");
    });
  }
  function saveReferral() {
    startTransition(async () => {
      const res = await setReferralSettingsAction(business.id, { enabled: rEnabled, points: rPoints });
      if (res.ok) toast.success("חבר מביא חבר נשמר ✓");
      else toast.error(res.error ?? "שגיאה");
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 p-4">
        {/* Popup */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="size-4 text-primary" /> פופאפ שיווקי
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pEnabled} onChange={(e) => setPEnabled(e.target.checked)} className="size-4" />
            הצג פופאפ למבקרים בחנות
          </label>
          <Input placeholder="כותרת (למשל: 10% הנחה!)" value={pTitle} onChange={(e) => setPTitle(e.target.value)} />
          <Textarea rows={2} placeholder="טקסט (למשל: הצטרפו וקבלו קוד הנחה)" value={pText} onChange={(e) => setPText(e.target.value)} />
          <Input dir="ltr" placeholder="קוד קופון להצגה (לא חובה)" value={pCoupon} onChange={(e) => setPCoupon(e.target.value)} />
          <Button onClick={savePopup} disabled={isPending} size="sm" className="gap-1.5 self-start">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} שמירת פופאפ
          </Button>
        </div>

        {/* Loyalty */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Gift className="size-4 text-primary" /> תוכנית נאמנות (נקודות)
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={lEnabled} onChange={(e) => setLEnabled(e.target.checked)} className="size-4" />
            הפעל צבירת נקודות ללקוחות רשומים
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">נקודות לכל ₪1</span>
              <Input dir="ltr" type="number" step="0.1" min="0" value={lEarn} onChange={(e) => setLEarn(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">שווי נקודה (₪)</span>
              <Input dir="ltr" type="number" step="0.01" min="0" value={lValue} onChange={(e) => setLValue(e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            דוגמה: 1 נקודה ל-₪1 ושווי 0.1 ₪ → 100 נקודות = ₪10 הנחה.
          </p>
          <Button onClick={saveLoyalty} disabled={isPending} size="sm" className="gap-1.5 self-start">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} שמירת נאמנות
          </Button>
        </div>

        {/* Referral */}
        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" /> חבר מביא חבר
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={rEnabled} onChange={(e) => setREnabled(e.target.checked)} className="size-4" />
            הפעל תוכנית הפניות
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">נקודות למפנה על כל חבר חדש שמזמין</span>
            <Input dir="ltr" type="number" min="0" step="1" value={rPoints} onChange={(e) => setRPoints(e.target.value)} className="w-32" />
          </label>
          <Button onClick={saveReferral} disabled={isPending} size="sm" className="gap-1.5 self-start">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} שמירת הפניות
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
