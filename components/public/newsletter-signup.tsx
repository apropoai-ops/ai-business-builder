"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

import { subscribeNewsletterAction } from "@/lib/actions/newsletter";
import { inkOn } from "@/lib/storefront-brand";

export function NewsletterSignup({
  slug,
  brand,
  // "start" is for the storefront footer, where this column sits beside two
  // start-aligned ones. Defaults to "center" so existing callers are unchanged.
  align = "center",
}: {
  slug: string;
  brand: string;
  align?: "center" | "start";
}) {
  const centered = align === "center";
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await subscribeNewsletterAction(slug, email, hp);
      if (!res.ok) setError(res.error ?? "ההרשמה נכשלה");
      else setDone(true);
    });
  }

  if (done) {
    return (
      <div
        role="status"
        className={`flex items-center gap-2 text-sm font-medium ${centered ? "justify-center" : ""}`}
      >
        <CheckCircle2 className="size-5" style={{ color: brand }} />
        תודה שנרשמתם! נתעדכן אתכם בקרוב 🙏
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      style={{ "--tw-ring-color": brand } as React.CSSProperties}
      className={`flex w-full flex-col gap-2 ${centered ? "mx-auto max-w-md" : ""}`}
    >
      <div className={`flex items-center gap-2 text-sm font-semibold ${centered ? "justify-center" : ""}`}>
        <Mail className="size-4" style={{ color: brand }} />
        הצטרפו לרשימת התפוצה
      </div>
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
      <div className="flex gap-2">
        <input
          // Explicit ink: this input lives in the footer, which the tier paints
          // #b8b8b8, and preflight gives inputs `color: inherit` — so typed
          // text rendered light-grey on the white field at ~2:1.
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-base text-black outline-none transition-shadow placeholder:text-zinc-500 focus:ring-2 sm:text-sm"
          placeholder="האימייל שלכם"
          aria-label="האימייל שלכם"
          autoComplete="email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={isPending || !email.trim()}
          className="flex shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: brand, color: inkOn(brand) }}
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : "הרשמה"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
