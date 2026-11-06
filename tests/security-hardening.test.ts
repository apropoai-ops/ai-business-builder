import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { safeNext } from "@/lib/auth/safe-next";
import { emailShell, escapeHtml } from "@/lib/email-templates";
import { openWhatsappSecret, sealWhatsappSecret } from "@/lib/whatsapp-secrets";

/** Regression guards for the 2026-10 security pass. */

describe("safeNext (post-login redirect target)", () => {
  it("keeps same-origin paths", () => {
    expect(safeNext("/invite/abc")).toBe("/invite/abc");
    expect(safeNext("/s/shop?x=1")).toBe("/s/shop?x=1");
  });

  it.each([
    "//evil.com",
    "/\\evil.com",
    "/\\/evil.com",
    "/\tevil.com",
    "/\nevil.com",
    "https://evil.com",
    "evil.com",
    "",
  ])("rejects %j", (next) => {
    expect(safeNext(next)).toBe("/businesses");
  });

  it("falls back on null", () => {
    expect(safeNext(null)).toBe("/businesses");
  });
});

describe("owner-email HTML escaping", () => {
  it("escapes markup in untrusted text", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });

  it("treats the shell title as plain text", () => {
    const html = emailShell("<img src=x onerror=alert(1)>", "<p>body</p>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("<p>body</p>");
  });
});

describe("WhatsApp secrets at rest", () => {
  const prev = process.env.PAYMENTS_ENC_KEY;
  beforeAll(() => {
    process.env.PAYMENTS_ENC_KEY = "a".repeat(64);
  });
  afterAll(() => {
    process.env.PAYMENTS_ENC_KEY = prev;
  });

  it("seals and opens round-trip without storing plaintext", () => {
    const sealed = sealWhatsappSecret("EAAG-secret-token");
    expect(sealed).toMatch(/^enc:v1:/);
    expect(sealed).not.toContain("EAAG-secret-token");
    expect(openWhatsappSecret(sealed)).toBe("EAAG-secret-token");
  });

  it("reads legacy plaintext unchanged and never double-seals", () => {
    expect(openWhatsappSecret("legacy-plain")).toBe("legacy-plain");
    const sealed = sealWhatsappSecret("x")!;
    expect(sealWhatsappSecret(sealed)).toBe(sealed);
  });

  it("maps empty input to null", () => {
    expect(sealWhatsappSecret("   ")).toBeNull();
    expect(openWhatsappSecret(null)).toBeNull();
  });
});
