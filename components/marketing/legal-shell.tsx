import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shared layout for the legal / policy pages (terms, privacy, refund, accessibility). */
export function LegalShell({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <main dir="rtl" className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" className="font-bold">
            AI Business Builder
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowRight className="size-4" />
            חזרה לבית
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">עודכן לאחרונה: {updated}</p>
        {intro && <p className="mt-5 leading-relaxed text-foreground/90">{intro}</p>}
        <div className="mt-8 space-y-2">{children}</div>
      </article>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} AI Business Builder · נבנה בעברית 🇮🇱
      </footer>
    </main>
  );
}

/** A titled section block inside a legal page. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pt-6">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
