"use client";

import { LogOut } from "lucide-react";

import { signOutCustomerAction } from "@/lib/actions/customer-auth";

/** Signs the shopper out and returns them to the storefront. */
export function SignOutButton({ slug }: { slug: string }) {
  return (
    <form action={signOutCustomerAction}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-red-600"
      >
        <LogOut className="size-4" />
        התנתקות
      </button>
    </form>
  );
}
