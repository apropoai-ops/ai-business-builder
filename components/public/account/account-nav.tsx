"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MapPin, CreditCard, CalendarDays } from "lucide-react";
import { inkOn } from "@/lib/storefront-brand";

/** Tab navigation across the personal-area sections. */
export function AccountNav({ slug, brand }: { slug: string; brand: string }) {
  const pathname = usePathname();
  const base = `/s/${slug}/account`;
  const tabs = [
    { href: base, label: "סקירה", icon: LayoutDashboard },
    { href: `${base}/orders`, label: "ההזמנות שלי", icon: Package },
    { href: `${base}/appointments`, label: "התורים שלי", icon: CalendarDays },
    { href: `${base}/addresses`, label: "כתובות", icon: MapPin },
    { href: `${base}/payment-methods`, label: "אמצעי תשלום", icon: CreditCard },
  ];

  return (
    <nav className="mb-6 flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              active
                ? "border-transparent text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
            style={active ? { backgroundColor: brand, color: inkOn(brand) } : undefined}
          >
            <Icon className="size-4" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
