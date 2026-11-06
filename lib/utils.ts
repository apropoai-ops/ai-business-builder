import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Safely serialize an object for injection into a `<script
 * type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />`
 * tag. JSON.stringify() alone does not escape "<", so owner/attacker-
 * controlled text fields (business description, FAQ answers, product
 * names, etc.) containing a literal "</script>" would otherwise close the
 * script tag early and let arbitrary HTML/script execute. Escaping "<" as
 * a unicode escape is valid inside a JSON string and neutralizes this
 * without changing the parsed JSON value.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
