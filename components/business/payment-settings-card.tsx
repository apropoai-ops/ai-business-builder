"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PAYMENT_METHODS, parseEnabledMethods, type PaymentMethodKey } from "@/lib/payments";
import { savePaymentSettingsAction } from "@/lib/actions/store-payments";
import type { Business } from "@/types/database";

type Bank = { bank?: string; branch?: string; account?: string; holder?: string };

/** Owner settings for which payment methods the storefront accepts + invoicing. */
export function PaymentSettingsCard({ business }: { business: Business }) {
  const [methods, setMethods] = useState<PaymentMethodKey[]>(
    parseEnabledMethods(business.payment_methods),
  );
  const bankInit = (business.bank_details as Bank | null) ?? {};
  const [bank, setBank] = useState<Bank>(bankInit);
  const [bitPhone, setBitPhone] = useState(business.bit_phone ?? "");
  const [paypalLink, setPaypalLink] = useState(business.paypal_link ?? "");
  const [cardLink, setCardLink] = useState(business.payment_link ?? "");
  const [taxId, setTaxId] = useState(business.business_tax_id ?? "");
  const [vatRate, setVatRate] = useState(String(business.vat_rate ?? 18));
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggle(key: PaymentMethodKey) {
    setMethods((m) => (m.includes(key) ? m.filter((k) => k !== key) : [...m, key]));
  }

  function save() {
    startTransition(async () => {
      const res = await savePaymentSettingsAction(business.id, {
        methods,
        bank,
        bitPhone,
        paypalLink,
        cardLink,
        taxId,
        vatRate,
      });
      if (!res.ok) {
        toast.error(res.error ?? "השמירה נכשלה");
        return;
      }
      toast.success("הגדרות התשלום נשמרו ✓");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  const on = (k: PaymentMethodKey) => methods.includes(k);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CreditCard className="size-4 text-primary" />
          תשלומים וחשבוניות
        </div>

        {/* Method toggles */}
        <div>
          <div className="mb-2 text-xs text-muted-foreground">
            אמצעי התשלום שיוצגו ללקוח בקופה:
          </div>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => toggle(m.key)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  on(m.key)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Card / PayPal links */}
        {on("card") && (
          <Field label="לינק תשלום באשראי (Stripe / PayBox / כל ספק)">
            <Input dir="ltr" value={cardLink} onChange={(e) => setCardLink(e.target.value)} placeholder="https://buy.stripe.com/..." />
          </Field>
        )}
        {on("paypal") && (
          <Field label="לינק PayPal">
            <Input dir="ltr" value={paypalLink} onChange={(e) => setPaypalLink(e.target.value)} placeholder="https://paypal.me/..." />
          </Field>
        )}

        {/* Bit */}
        {on("bit") && (
          <Field label="מספר Bit לקבלת תשלום">
            <Input dir="ltr" value={bitPhone} onChange={(e) => setBitPhone(e.target.value)} placeholder="050-0000000" />
          </Field>
        )}

        {/* Bank transfer */}
        {on("bank_transfer") && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="בנק">
              <Input value={bank.bank ?? ""} onChange={(e) => setBank({ ...bank, bank: e.target.value })} />
            </Field>
            <Field label="סניף">
              <Input dir="ltr" value={bank.branch ?? ""} onChange={(e) => setBank({ ...bank, branch: e.target.value })} />
            </Field>
            <Field label="מספר חשבון">
              <Input dir="ltr" value={bank.account ?? ""} onChange={(e) => setBank({ ...bank, account: e.target.value })} />
            </Field>
            <Field label="על שם">
              <Input value={bank.holder ?? ""} onChange={(e) => setBank({ ...bank, holder: e.target.value })} />
            </Field>
          </div>
        )}

        {/* Invoicing */}
        <div className="grid grid-cols-2 gap-2 border-t pt-3">
          <Field label="ע.מ / ח.פ (לחשבוניות)">
            <Input dir="ltr" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="123456789" />
          </Field>
          <Field label="אחוז מע״מ">
            <Input dir="ltr" type="number" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
          </Field>
        </div>

        <div>
          <Button onClick={save} disabled={isPending} className="gap-1.5">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : saved ? <Check className="size-4" /> : null}
            שמירה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
