"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { visibleDepartments } from "@/lib/dashboard-departments";
import type { BusinessNavKey } from "@/lib/site-mode";


/**
 * The dashboard sidebar, filtered by the business's build mode: a landing page
 * has no store, no blog pipeline and no booking calendar, so those screens
 * aren't offered at all (lib/site-mode.ts owns the list). The pages themselves
 * 404 too — see lib/dashboard-guard.ts.
 *
 * Departments are purely presentational: the mode filter still runs per item,
 * and a group that ends up empty disappears with it.
 */
export function BusinessNav({
  businessId,
  siteMode,
  sellsNights = false,
  hasRentals = false,
  hiddenNavKeys,
}: {
  businessId: string;
  siteMode?: string | null;
  /**
   * Accommodation business — the unit catalog lives inside the חנות screen, so
   * it needs that link even in a mode that sells no products (lib/site-mode.ts).
   */
  sellsNights?: boolean;
  /**
   * Entitled to the `rentals` feature. "לוח לילות" is gated by the PLAN, not by
   * the build mode, so it is answered here rather than by `hiddenNav` — and it
   * is hidden outright rather than shown-and-404ing, because a nav item that
   * only ever leads to an upgrade wall is noise on every other screen.
   */
  hasRentals?: boolean;
  /** AI-picked vertical-specific keys this business doesn't need — see lib/dashboard-departments.ts. */
  hiddenNavKeys?: string[];
}) {
  const pathname = usePathname();
  const base = `/businesses/${businessId}`;
  const groups = visibleDepartments({ siteMode, sellsNights, hasRentals, hiddenNavKeys });

  const isActive = (key: BusinessNavKey) => pathname.startsWith(`${base}/${key}`);
  const current = groups.flatMap((g) => g.items).find((i) => isActive(i.key));

  // Phone: the whole grouped list behind one disclosure, so the nav costs a row
  // instead of a screen. Desktop keeps it permanently open (CSS, below).
  // Closing happens on the link's own click rather than in an effect watching
  // pathname — same result, one less render, and no state-set inside an effect.
  const [open, setOpen] = useState(false);

  return (
    <nav aria-label="תפריט העסק">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="business-nav-groups"
        className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium md:hidden"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        <span>{current ? current.label : "תפריט העסק"}</span>
      </button>

      <div
        id="business-nav-groups"
        className={cn("mt-2 md:mt-0 md:block", open ? "block" : "hidden")}
      >
        {groups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={`nav-group-${group.id}`}
            style={{ "--dept": `var(--dept-${group.id})` } as CSSProperties}
          >
            <h2 id={`nav-group-${group.id}`} className="nav-group-title">
              {group.label}
            </h2>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const href = `${base}/${item.key}`;
                const active = isActive(item.key);

                return (
                  <li key={item.key}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className="nav-link"
                    >
                      <item.icon className="size-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
