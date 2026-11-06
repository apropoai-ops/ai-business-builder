"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Send, CheckCircle2 } from "lucide-react";

import { submitPublicLeadAction } from "@/lib/actions/public-site";
import { TurnstileField } from "@/components/public/turnstile-field";
import { inkOn } from "@/lib/storefront-brand";

export function SiteLeadForm({
  slug,
  brandColor,
  fields,
}: {
  slug: string;
  brandColor: string;
  fields: string[];
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const wantsEmail = fields.some((f) => /מייל|אימייל|email/i.test(f));
  const wantsMessage = fields.some((f) => /הודעה|פנייה|message|תיאור/i.test(f));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const captchaToken =
      (formRef.current?.elements.namedItem("captchaToken") as HTMLInputElement | null)
        ?.value || null;
    startTransition(async () => {
      const res = await submitPublicLeadAction(slug, {
        name,
        phone,
        email,
        message,
        company_website: hp,
        captchaToken,
      });
      if (!res.ok) setError(res.error ?? "שליחה נכשלה");
      else setSent(true);
    });
  }

  if (sent) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-3 rounded-2xl border border-black/10 bg-white p-6 text-center shadow-sm"
      >
        <CheckCircle2 className="size-10" style={{ color: brandColor }} />
        <p className="text-lg font-semibold">הפרטים התקבלו!</p>
        <p className="text-sm text-zinc-500">נחזור אליכם בהקדם 🙏</p>
      </div>
    );
  }

  // bg-black/[0.04], not bg-white: the professional tier remaps `.bg-white`
  // inside a module-section to #121214 — the same fill it gives the card these
  // inputs sit in, so the fields dissolved into the card. A translucent wash
  // isn't remapped, so it reads as a subtle well on light AND darker than the
  // card on dark. Changing the border colour wouldn't help: the tier overrides
  // `border` with !important.
  // text-base below sm: anything under 16px makes mobile Safari zoom the page
  // on focus, which then leaves the visitor zoomed in on a half-filled form.
  const inputCls =
    "w-full rounded-lg border border-zinc-200 bg-black/[0.04] px-3 py-2.5 text-base outline-none transition-shadow focus:ring-2 sm:text-sm";

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      // --tw-ring-color inherits, so one declaration here brands every field's
      // focus ring instead of leaving them the default blue.
      style={{ "--tw-ring-color": brandColor } as React.CSSProperties}
      className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
    >
      {/* Honeypot — invisible to humans, irresistible to bots */}
      <input
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        style={{ position: "absolute", left: "-9999px", height: 0, width: 0, opacity: 0 }}
        aria-hidden="true"
      />
      {/* Real labels, visually hidden — a placeholder is not a label: it
          disappears the moment the visitor types, taking the "* חובה" marker
          with it, and screen readers get nothing to announce. */}
      <label htmlFor="lf-name" className="sr-only">שם מלא (חובה)</label>
      <input
        id="lf-name"
        name="name"
        autoComplete="name"
        className={inputCls}
        placeholder="שם מלא *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        minLength={2}
      />
      <label htmlFor="lf-phone" className="sr-only">טלפון</label>
      <input
        id="lf-phone"
        name="phone"
        autoComplete="tel"
        dir="auto"
        className={inputCls}
        placeholder="טלפון"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      {wantsEmail && (
        <>
          <label htmlFor="lf-email" className="sr-only">אימייל</label>
          <input
            id="lf-email"
            name="email"
            autoComplete="email"
            dir="auto"
            className={inputCls}
            placeholder="אימייל"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </>
      )}
      {wantsMessage && (
        <>
          <label htmlFor="lf-message" className="sr-only">איך נוכל לעזור?</label>
          <textarea
            id="lf-message"
            name="message"
            className={`${inputCls} resize-y`}
            placeholder="איך נוכל לעזור?"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </>
      )}
      <TurnstileField />
      {/* A light chip, not bare red text — plain text-red-600 dropped under AA
          on the professional tier's near-black card, and nothing announced it. */}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        data-el="btn-primary"
        disabled={isPending || name.trim().length < 2}
        className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: brandColor, color: inkOn(brandColor) }}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        שליחה
      </button>
    </form>
  );
}
