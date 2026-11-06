import { describe, expect, it } from "vitest";

import { lastAuthMethod } from "@/lib/auth/amr";

/** Builds a JWT-shaped string whose payload carries the given claims. */
function token(claims: unknown): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString(
    "base64url",
  );
  return `header.${payload}.signature`;
}

describe("lastAuthMethod", () => {
  it("reads the newest method — amr is ordered newest first", () => {
    const t = token({
      amr: [
        { method: "totp", timestamp: 1666086056 },
        { method: "password", timestamp: 1666085924 },
      ],
    });
    expect(lastAuthMethod(t)).toBe("totp");
  });

  it("reports recovery for a password-reset session", () => {
    expect(lastAuthMethod(token({ amr: [{ method: "recovery" }] }))).toBe(
      "recovery",
    );
  });

  it("reports oauth for a Google sign-in — the case that must NOT be sent to the password screen", () => {
    expect(lastAuthMethod(token({ amr: [{ method: "oauth" }] }))).toBe("oauth");
  });

  it("survives a payload with non-ASCII claims (Hebrew names in user_metadata)", () => {
    const t = token({
      user_metadata: { full_name: "אופק כהן" },
      amr: [{ method: "oauth" }],
    });
    expect(lastAuthMethod(t)).toBe("oauth");
  });

  // Every unreadable shape must fall back to null, i.e. "ordinary sign-in":
  // guessing "recovery" is what forced a password change on every login.
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["empty", ""],
    ["not a jwt", "just-a-string"],
    ["no payload segment", "header..signature"],
    ["undecodable payload", "header.@@@not-base64@@@.signature"],
  ])("returns null for %s", (_label, value) => {
    expect(lastAuthMethod(value as string | undefined | null)).toBeNull();
  });

  it("returns null when the claims carry no amr", () => {
    expect(lastAuthMethod(token({ sub: "user-id" }))).toBeNull();
  });

  it("returns null when amr is present but malformed", () => {
    expect(lastAuthMethod(token({ amr: "recovery" }))).toBeNull();
    expect(lastAuthMethod(token({ amr: [] }))).toBeNull();
    expect(lastAuthMethod(token({ amr: [{ timestamp: 1 }] }))).toBeNull();
  });
});
