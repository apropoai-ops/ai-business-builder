import { describe, it, expect } from "vitest";

import { normalizePhoneForWhatsapp } from "@/lib/phone";

describe("normalizePhoneForWhatsapp", () => {
  it("converts Israeli mobile formats to 972", () => {
    expect(normalizePhoneForWhatsapp("0501234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("050-123-4567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("050 123 4567")).toBe("972501234567");
  });

  it("keeps numbers that already carry a country code", () => {
    expect(normalizePhoneForWhatsapp("972501234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("+972-50-1234567")).toBe("972501234567");
    expect(normalizePhoneForWhatsapp("14155550172")).toBe("14155550172");
  });

  it("converts landlines too", () => {
    expect(normalizePhoneForWhatsapp("03-1234567")).toBe("97231234567");
  });

  it("rejects garbage", () => {
    expect(normalizePhoneForWhatsapp("123")).toBeNull();
    expect(normalizePhoneForWhatsapp("אין טלפון")).toBeNull();
  });
});
